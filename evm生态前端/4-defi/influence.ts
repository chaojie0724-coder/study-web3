import {Token, CurrencyAmount, Percent, Price} from '@uniswap/sdk-core';
import {Pair} from '@uniswap/v2-sdk';
import {createPublicClient, http} from 'viem';
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


// 3. V2 池子 ABI (只需要 getReserves)
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

async function calculateTradeDetails() {
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

    // 假设用户想输入50个WETH(这是一个大额交易，容易产生价格影响)
    const inputAmount = CurrencyAmount.fromRawAmount(WETH, 50000000000000000000);

    const [outputAmount] = pair.getOutputAmount(inputAmount);

    // 计算中间价：1WETH = ？USDC
    const midPrice = pair.priceOf(WETH);

    // 计算执行价：这次交易平均1WETH = ？USDC
    const executionPrice = new Price(
        WETH,
        USDC,
        inputAmount.quotient,
        outputAmount.quotient
    );

    // 计算价格影响：公式：1 - （执行价 / 中间价）
    const priceRatio = executionPrice.divide(midPrice);
    const oneHundredPercent = new Percent('1', '1');
    const priceImpactFraction = oneHundredPercent.subtract(priceRatio);
    const priceImpact = new Percent(
        priceImpactFraction.numerator,
        priceImpactFraction.denominator
    );

    console.log('用户要交易50个WETH');
    console.log(`中间价: ${midPrice.toSignificant(6)} USDC/WETH`);
    console.log(`执行价: ${executionPrice.toSignificant(6)} USDC/WETH`);
    console.log(`价格影响: ${priceImpact.toFixed(2)}%`);
}

calculateTradeDetails();