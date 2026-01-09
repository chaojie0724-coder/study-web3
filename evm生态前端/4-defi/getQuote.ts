import {createPublicClient, http, parseAbi, parseUnits, formatUnits, getAddress} from 'viem'
import {ethers} from 'ethers'
import {sepolia} from 'viem/chains'
import QuoterV2 from '@uniswap/v3-periphery/artifacts/contracts/lens/QuoterV2.sol/QuoterV2.json'

const INFURA_KEY = 'dd906fdb57cb485194608a1794d1cac0'
const client = createPublicClient({
    chain: sepolia,
    transport: http(`https://sepolia.infura.io/v3/${INFURA_KEY}`)
})

const QUOTER_CONTRACT_ADDRESS = getAddress('0xEd1f6473345F45b75F8179591dd5bA1888cf2FB3')

const WETH = getAddress('0xfff9976782d46cc05630d1f6ebab18b2324d6b14')
const USDC = getAddress('0x1c7d4b196cb0c7b01d743fbc6116a902379c7238')

async function getV3QuoteFinal() {
    const amountIn = parseUnits('1', 18)
    const fee = 500
    const res = await client.simulateContract({
        address: QUOTER_CONTRACT_ADDRESS,
        abi: QuoterV2.abi,
        functionName: 'quoteExactInputSingle',
        args: [{
            tokenIn: WETH,
            tokenOut: USDC,
            fee,
            amountIn: amountIn,
            sqrtPriceLimitX96: 0n
        }]
    })
    const result = res.result as [bigint, bigint, number, bigint];

    console.log(`✅ 报价成功！`)
    console.log(`输入: 1 WETH`)
    console.log(`预期获得: ${formatUnits(result[0], 6)} USDC`)
    console.log(`预估消耗 Gas: ${result[3].toString()}`)
}

getV3QuoteFinal()