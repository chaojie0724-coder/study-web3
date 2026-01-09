import {createPublicClient, http, parseAbi, getAddress} from 'viem'
import {sepolia} from 'viem/chains'
import {computePoolAddress, Pool} from '@uniswap/v3-sdk'
import {Token} from '@uniswap/sdk-core'

// 1. 常量配置
const CHAIN_ID = 11155111
// 注意：Sepolia 的 Factory 地址与主网不同
const V3_FACTORY = getAddress('0x0227628f3F023bb0B980b67D528571c95c6DaC1c')

// 使用 getAddress 确保地址符合 SDK 的校验要求
const WETH_ADDRESS = getAddress('0xfff9976782d46cc05630d1f6ebab18b2324d6b14')
const USDC_ADDRESS = getAddress('0x1c7d4b196cb0c7b01d743fbc6116a902379c7238') // 你提供的地址

const WETH = new Token(CHAIN_ID, WETH_ADDRESS, 18, 'WETH', 'Wrapped Ether')
const USDC = new Token(CHAIN_ID, USDC_ADDRESS, 6, 'USDC', 'USD Coin')

const client = createPublicClient({
    chain: sepolia,
    transport: http('https://sepolia.infura.io/v3/dd906fdb57cb485194608a1794d1cac0')
})

async function getPoolData() {
    const fee = 3000;
    // 2. 离线计算池子地址 (WETH/USDC)
    // 我们先尝试 0.3% (fee: 3000) 的池子
    const poolAddress = computePoolAddress({
        factoryAddress: V3_FACTORY,
        tokenA: WETH,
        tokenB: USDC,
        fee,
    }) as `0x${string}`;

    console.log('Sepolia Pool 地址:', poolAddress)

    try {
        // 3. 并行获取 slot0 和 liquidity
        const [slot0, liquidity] = await Promise.all([
            client.readContract({
                address: poolAddress,
                abi: parseAbi(['function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16, uint16, uint16, uint8, bool)']),
                functionName: 'slot0',
            }),
            client.readContract({
                address: poolAddress,
                abi: parseAbi(['function liquidity() view returns (uint128)']),
                functionName: 'liquidity',
            })
        ])

        const [sqrtPriceX96, tick] = slot0

        const pool = new Pool(
            WETH,
            USDC,
            fee,
            sqrtPriceX96.toString(),
            liquidity.toString(),
            Number(tick),
        );
        console.log('--- 获取slot0成功 ---')
        console.log('sqrtPriceX96:', sqrtPriceX96.toString())
        console.log('当前 Tick:', tick)
        console.log('--- 实时价格 (Sepolia) ---')
        console.log(`1 WETH = ${pool.token0Price.toSignificant(6)} USDC`);
        console.log(`1 USDC = ${pool.token1Price.toSignificant(6)} WETH`);
    } catch (error) {
        console.log(error)
    }
}

getPoolData()