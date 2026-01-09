import {Token} from '@uniswap/sdk-core';
import {createPublicClient, http} from 'viem';
import {mainnet} from 'viem/chains';

const chainId = 1;
const WETH = new Token(chainId, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 18, 'WETH');
const USDC = new Token(chainId, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 6, 'USDC');

const client = createPublicClient({
    chain: mainnet,
    transport: http(),
});

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

async function main() {
    console.log('正在查询池子地址');

    const pairAddress = await client.readContract({
        address: V2_FACTORY_ADDRESS,
        abi: V2_FACTORY_ABI,
        functionName: 'getPair',
        args: [WETH.address as `0x${string}`, USDC.address as `0x${string}`]
    })

    console.log(`✅ 找到 WETH/USDC 池子地址: ${pairAddress}`);
}

main();