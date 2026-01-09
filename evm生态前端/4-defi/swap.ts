import {Token, CurrencyAmount, Percent, Price} from '@uniswap/sdk-core';
import {Pair} from '@uniswap/v2-sdk';
import {createPublicClient, encodeFunctionData, http} from 'viem';
import {mainnet} from 'viem/chains';

// 1. 定义 Token (之前写的)
const WETH = new Token(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH');
const USDC = new Token(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC');

// 2. Viem Client
const client = createPublicClient({chain: mainnet, transport: http()});

const V2_FACTORY_ADDRESS = '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f';
const V2_FACTORY_ABI = [
    {
        constant: true,
        inputs: [
            {name: 'tokenA', type: 'address'},
            {name: 'tokenB', type: 'address'},
        ],
        name: 'getPair',
        outputs: [{name: 'pair', type: 'address'}],
        payable: false,
        stateMutability: 'view',
        type: 'function',
    }
] as const;

const V2_ROUTER_ADDRESS = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D';

// 准备 swapExactTokensForTokens 的 ABI
const V2_ROUTER_ABI = [
  {
    name: 'swapExactTokensForTokens',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'path', type: 'address[]' },
      { name: 'to', type: 'address' },
      { name: 'deadline', type: 'uint256' },
    ],
    outputs: [{ name: 'amounts', type: 'uint256[]' }],
  },
] as const;


const V2_PAIR_ABI = [
    {
        constant: true,
        inputs: [],
        name: 'getReserves',
        outputs: [
            {name: 'reserve0', type: 'uint112'},
            {name: 'reserve1', type: 'uint112'},
            {name: 'blockTimestampLast', type: 'uint32'},
        ],
        payable: false,
        stateMutability: 'view',
        type: 'function',
    },
] as const;

async function getPairAddress() {
    const pairAddress = await client.readContract({
        address: V2_FACTORY_ADDRESS,
        abi: V2_FACTORY_ABI,
        functionName: 'getPair',
        args: [WETH.address as `0x${string}`, USDC.address as `0x${string}`]
    })

    return Promise.resolve(pairAddress);
}

async function prepareSwap() {
    const PAIR_ADDRESS = await getPairAddress();

    const [reserve0, reserve1] = await client.readContract({
        address: PAIR_ADDRESS,
        abi: V2_PAIR_ABI,
        functionName: "getReserves",
    });

    const tokens = [WETH, USDC].sort((a, b) => a.address.toLocaleLowerCase() < b.address.toLocaleLowerCase() ? -1 : 1);
    const pair = new Pair(
        CurrencyAmount.fromRawAmount(tokens[0], reserve0.toString()),
        CurrencyAmount.fromRawAmount(tokens[1], reserve1.toString())
    )

    // 假设用户想输入50个WETH
    const inputAmount = CurrencyAmount.fromRawAmount(WETH, 50000000000000000000);
    const [outputAmount] = pair.getOutputAmount(inputAmount);

    // 定义滑点公差，以0.5%为例子
    const slippageTolerance = new Percent('50', '10000');

    // 计算保留比例，100% - 滑点%
    const oneHundredPercent = new Percent('1', '1');
    const minimumPercent = oneHundredPercent.subtract(slippageTolerance);

    // 计算最小收到金额: 预计产出 * 99.5%
    const minAmountRaw = minimumPercent.multiply(outputAmount.quotient).quotient;

    const minAmountOut = CurrencyAmount.fromRawAmount(
        outputAmount.currency, // USDC
        minAmountRaw.toString()
    );

    console.log(`卖出1WETH`);

    // 卖出1WETH
    const amountIn = 1000000000000000000n;

    // deadline，当前时间+20分钟
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200);

    // path
    const path = [WETH.address, USDC.address] as `0x${string}`[];

    const recipient = '0xf0A09d2F8e26DDf62560a86E443979947974b543';

    const txData = encodeFunctionData({
        abi: V2_ROUTER_ABI,
        functionName: 'swapExactTokensForTokens',
        args: [
            amountIn,
            BigInt(minAmountOut.quotient.toString()),
            path,
            recipient,
            deadline,
        ]
    })

    console.log('✅ 交易数据已生成:', txData);
}

prepareSwap();