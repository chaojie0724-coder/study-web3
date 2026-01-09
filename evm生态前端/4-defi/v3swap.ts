import {
    createPublicClient,
    createWalletClient,
    http,
    getAddress,
    decodeAbiParameters,
    erc20Abi,
    formatUnits,
    parseUnits,
    parseGwei
} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {sepolia} from 'viem/chains';
import {CurrencyAmount, Percent, Token, TradeType} from '@uniswap/sdk-core';
import {Pool, Route, SwapOptions, SwapRouter, Trade, SwapQuoter} from '@uniswap/v3-sdk';

/**
 * 1. 配置
 */
const INFURA_KEY = 'dd906fdb57cb485194608a1794d1cac0';
const PRIVATE_KEY = '0x95507c961e46fca9ffa8f0dab5e05efb07feacfc555de1f3a5b0cae0f317088d';

const WETH_ADDR = '0xfff9976782d46cc05630d1f6ebab18b2324d6b14';
const USDC_ADDR = '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238';
const ROUTER_ADDR = '0x3bFA4769FB09eefC5a80d6E87c3B91650a76c597';
const QUOTER_ADDR = '0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3';
const POOL_ADDR = '0x3289680dD4d6C10bb19b899729cda5eEF58AEfF1';

const WETH_TOKEN = new Token(11155111, WETH_ADDR, 18, 'WETH');
const USDC_TOKEN = new Token(11155111, USDC_ADDR, 6, 'USDC');

const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);
const publicClient = createPublicClient({chain: sepolia, transport: http(`https://sepolia.infura.io/v3/${INFURA_KEY}`)});
const walletClient = createWalletClient({account, chain: sepolia, transport: http(`https://sepolia.infura.io/v3/${INFURA_KEY}`)});

/**
 * 2. 状态查询辅助
 */
async function getPoolState() {
    const abi = [
        {name: 'slot0', type: 'function', inputs: [], outputs: [{name: 'sqrtPriceX96', type: 'uint160'}, {name: 'tick', type: 'int24'}]},
        {name: 'liquidity', type: 'function', inputs: [], outputs: [{name: 'liquidity', type: 'uint128'}]}
    ] as const;
    const [slot0, liquidity] = await Promise.all([
        publicClient.readContract({address: getAddress(POOL_ADDR), abi, functionName: 'slot0'}),
        publicClient.readContract({address: getAddress(POOL_ADDR), abi, functionName: 'liquidity'})
    ]);
    return {sqrtPriceX96: slot0[0], tick: slot0[1], liquidity};
}

async function checkBalances(label: string) {
    const [weth, usdc] = await Promise.all([
        publicClient.readContract({address: getAddress(WETH_ADDR), abi: erc20Abi, functionName: 'balanceOf', args: [account.address]}),
        publicClient.readContract({address: getAddress(USDC_ADDR), abi: erc20Abi, functionName: 'balanceOf', args: [account.address]})
    ]);
    console.log(`${label} -> WETH: ${formatUnits(weth, 18)} | USDC: ${formatUnits(usdc, 6)}`);
    return {weth, usdc};
}

/**
 * 3. 主函数
 */
async function main() {
    try {
        console.log('--- 启动交易验证流程 ---');
        const initialBalances = await checkBalances('【交易前余额】');

        // A. 准备 SDK 环境
        const state = await getPoolState();
        const pool = new Pool(WETH_TOKEN, USDC_TOKEN, 500, state.sqrtPriceX96.toString(), state.liquidity.toString(), state.tick);
        const swapRoute = new Route([pool], WETH_TOKEN, USDC_TOKEN);
        const amountIn = parseUnits('0.001', 18);

        // B. 精确获取报价并处理精度
        const {calldata: quoteData} = SwapQuoter.quoteCallParameters(
            swapRoute,
            CurrencyAmount.fromRawAmount(WETH_TOKEN, amountIn.toString()),
            TradeType.EXACT_INPUT,
            {useQuoterV2: true}
        );
        const quoteRes = await publicClient.call({to: getAddress(QUOTER_ADDR), data: quoteData as `0x${string}`});
        const quoteAmountOut = decodeAbiParameters([{type: 'uint256'}], quoteRes.data!)[0] as bigint;

        console.log(`实时报价: 0.001 WETH ≈ ${formatUnits(quoteAmountOut, 6)} USDC`);

        // C. 设置合理的滑点 (0.5%)
        // 重要：确保 amountOutMinimum 也是 6 位精度的 bigint
        const amountOutMinimum = (quoteAmountOut * 995n) / 1000n;
        console.log(`滑点保护: 最小接收量应为 ${formatUnits(amountOutMinimum, 6)} USDC`);

        // D. 构建 Trade 对象
        const trade = Trade.createUncheckedTrade({
            route: swapRoute,
            inputAmount: CurrencyAmount.fromRawAmount(WETH_TOKEN, amountIn.toString()),
            outputAmount: CurrencyAmount.fromRawAmount(USDC_TOKEN, amountOutMinimum.toString()),
            tradeType: TradeType.EXACT_INPUT,
        });

        // E. 检查授权
        const allowance = await publicClient.readContract({
            address: getAddress(WETH_ADDR),
            abi: erc20Abi,
            functionName: 'allowance',
            args: [account.address, getAddress(ROUTER_ADDR)]
        });

        if (allowance < amountIn) {
            console.log('正在执行授权...');
            const h = await walletClient.writeContract({
                address: getAddress(WETH_ADDR),
                abi: erc20Abi,
                functionName: 'approve',
                args: [getAddress(ROUTER_ADDR), parseUnits('1', 18)]
            });
            await publicClient.waitForTransactionReceipt({hash: h});
        }

        // F. 生成 Calldata 并发送
        const options: SwapOptions = {
            slippageTolerance: new Percent(50, 10_000), // 0.5%
            deadline: Math.floor(Date.now() / 1000) + 60 * 20,
            recipient: account.address,
        };
        const methodParameters = SwapRouter.swapCallParameters([trade], options);

        console.log('正在发送 Swap 交易...');
        // B. 自动获取实时 Gas 价格预估
        const { maxFeePerGas, maxPriorityFeePerGas } = await publicClient.estimateFeesPerGas();
        console.log(`当前建议 Gas: Max=${formatUnits(maxFeePerGas!, 9)} gwei, Tip=${formatUnits(maxPriorityFeePerGas!, 9)} gwei`);
        const txHash = await walletClient.sendTransaction({
            account,
            to: getAddress(ROUTER_ADDR),
            data: methodParameters.calldata as `0x${string}`,
            value: 0n, // WETH 交换无需附带 ETH
            maxFeePerGas,
            maxPriorityFeePerGas
        });

        console.log(`🚀 交易哈希: ${txHash}`);
        const receipt = await publicClient.waitForTransactionReceipt({hash: txHash});

        // G. 关键：结果验证逻辑
        if (receipt.status === 'success') {
            console.log('✅ 链上状态：Success');

            // 检查收据中是否有代币转移事件 (Transfer)
            const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
            const transfers = receipt.logs.filter(log => log.topics[0] === transferEventSignature);

            if (transfers.length > 0) {
                console.log(`🎉 检测到 ${transfers.length} 笔代币转移事件，交易已真正执行！`);
            } else {
                console.log('⚠️ 警告：虽然状态为 Success，但没有检测到代币转移。请检查滑点设置是否依然过高。');
            }
        } else {
            console.error('❌ 交易失败 (Reverted)');
        }

        await checkBalances('【交易后余额】');

    } catch (error: any) {
        console.error('❌ 流程错误:', error.message);
    }
}

async function diagnosticNonce() {
  // 1. 获取已确认的最新 Nonce (当前该发哪一个)
  const confirmedNonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: 'latest'
  });

  // 2. 获取包含 Pending 在内的 Nonce (总共发到了哪一个)
  const pendingNonce = await publicClient.getTransactionCount({
    address: account.address,
    blockTag: 'pending'
  });

  console.log(`已确认 Nonce: ${confirmedNonce}`);
  console.log(`包含 Pending 的下个 Nonce: ${pendingNonce}`);

  if (pendingNonce > confirmedNonce) {
    console.log(`⚠️ 你的账户有 ${pendingNonce - confirmedNonce} 笔交易正在 Pending。`);
    console.log(`👉 阻塞队列的首笔交易 Nonce 是: ${confirmedNonce}`);
  } else {
    console.log('✅ 你的账户目前没有阻塞的交易。');
  }
}


async function unblockAccount() {
  console.log('--- 正在执行阻塞清理：强制覆盖 Nonce 32 ---');

  // 1. 获取当前网络建议的 Gas 价格并翻倍，确保“暴力插队”
  const gasPrice = await publicClient.getGasPrice();
  const fastGasPrice = (gasPrice * 2n); // 翻倍处理

  try {
    const hash = await walletClient.sendTransaction({
      to: account.address, // 发给自己
      value: 0n,           // 转账 0 ETH
      nonce: 33,           // 强制指定为阻塞的那个 Nonce
      maxFeePerGas: fastGasPrice,
      maxPriorityFeePerGas: parseGwei('0.007'), // 给矿工的小费设高点
      account
    });

    console.log(`🚀 清理交易已发出！Hash: ${hash}`);
    console.log('正在等待 Nonce 32 被确认...');
    
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log(`🎉 Nonce 32 已成功清理！区块: ${receipt.blockNumber}`);
    console.log('现在你可以重新运行你的 Swap 脚本了。');
    
  } catch (error: any) {
    console.error('清理失败:', error.shortMessage || error.message);
  }
}

// unblockAccount();

main();
// diagnosticNonce();