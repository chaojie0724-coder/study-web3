import {createPublicClient, createWalletClient, http, encodeFunctionData, parseEther} from 'viem';
import {privateKeyToAccount} from 'viem/accounts';
import {sepolia} from 'viem/chains';

/** * 1. 配置基础信息 
 */
const WETH_ADDRESS = '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14';
const V2_ROUTER_ADDRESS = '0xC532a74256D3Db42D0Bf7a0400fEFDbad7694008';
const PRIVATE_KEY = '0x95507c961e46fca9ffa8f0dab5e05efb07feacfc555de1f3a5b0cae0f317088d';
const account = privateKeyToAccount(PRIVATE_KEY as `0x${string}`);

const ERC20_ABI = [
    {name: 'allowance', type: 'function', inputs: [{name: 'o', type: 'address'}, {name: 's', type: 'address'}], outputs: [{type: 'uint256'}]},
    {name: 'approve', type: 'function', inputs: [{name: 's', type: 'address'}, {name: 'a', type: 'uint256'}], outputs: [{type: 'bool'}]}
] as const;

const V2_ROUTER_ABI = [
    {
        name: 'swapExactTokensForTokens',
        type: 'function',
        inputs: [
            {name: 'amountIn', type: 'uint256'},
            {name: 'amountOutMin', type: 'uint256'},
            {name: 'path', type: 'address[]'},
            {name: 'to', type: 'address'},
            {name: 'deadline', type: 'uint256'}
        ],
        outputs: [{type: 'uint256[]'}]
    }
] as const;

const publicClient = createPublicClient({chain: sepolia, transport: http()});
const walletClient = createWalletClient({account, chain: sepolia, transport: http()});

async function runFullSwapFlow() {
    // 卖0.01WETH
    const amountIn = parseEther('0.001');
    const amountOutMin = 0n;

    try {
        console.log('--- 步骤 1: 检查授权 ---')
        const allowance = await publicClient.readContract({
            address: WETH_ADDRESS,
            abi: ERC20_ABI,
            functionName: 'allowance',
            args: [account.address, V2_ROUTER_ADDRESS],
        }) as bigint;

        if (allowance < amountIn) {
            console.log('余额授权不足，正在发起 Approve...');
            const approveHash = await walletClient.writeContract({
                address: WETH_ADDRESS,
                abi: ERC20_ABI,
                functionName: 'approve',
                args: [V2_ROUTER_ADDRESS, amountIn * 100n],
            });
            console.log(`⏳ Approve 交易已提交: ${approveHash}`);
            await publicClient.waitForTransactionReceipt({hash: approveHash});
            console.log('✅ Approve 成功！');
        }
        else {
            console.log('✅ 授权额度充足');
        }

        console.log('--- 步骤 2: 执行 Swap ---');

        const userAddress = '0xf0A09d2F8e26DDf62560a86E443979947974b543';
        // 1. 查 WETH 余额
        const balance = await publicClient.readContract({
            address: WETH_ADDRESS,
            abi: [{name: 'balanceOf', type: 'function', inputs: [{type: 'address'}], outputs: [{type: 'uint256'}]}],
            functionName: 'balanceOf',
            args: [userAddress],
        });
        console.log(`你的 WETH 余额: ${balance.toString()}`);

        const deadline = BigInt(Math.floor(Date.now() / 1000 + 1200));
        const path = [WETH_ADDRESS, '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238'] as `0x${string}`[];

        const swapHash = await walletClient.writeContract({
            address: V2_ROUTER_ADDRESS,
            abi: V2_ROUTER_ABI,
            functionName: 'swapExactTokensForTokens',
            args: [amountIn, amountOutMin, path, account.address, deadline]
        })

        console.log(`🚀 Swap 交易已提交！哈希: ${swapHash}`);
        const receipt = await publicClient.waitForTransactionReceipt({hash: swapHash});
        console.log(`🎉 交易结果: ${receipt.status === 'success' ? '成功' : '失败'}`);
    } catch (error) {
        console.error('❌ 执行出错:', error);
    }
}

runFullSwapFlow();