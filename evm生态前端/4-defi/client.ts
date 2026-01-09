import {Token} from "@uniswap/sdk-core";
import {createPublicClient, http} from "viem";
import {mainnet} from "viem/chains";

const chainId = 1;

const WETH = new Token(
    chainId,                                      // 链 ID
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // 合约地址：这是 WETH 在主网的真实地址
    18,                                           // 精度：WETH 是 18 位
    'WETH',                                       // 符号：用于 UI 显示
    'Wrapped Ether'                               // 全称
);

const USDC = new Token(
    chainId,
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC 地址
    6,                                            // ⚠️ 注意：USDC 只有 6 位精度
    'USDC',
    'USD Coin'
);

// 1. 创建 Public Client
// 这是我们与区块链交互的入口
const client = createPublicClient({
    chain: mainnet, // 指定我们要连接的链：以太坊主网
    transport: http(), // 使用默认的 HTTP 传输协议
});

async function checkConnection() {
    try {
        const blockNumber = await client.getBlockNumber();
        console.log(`✅ 成功连接到以太坊主网！当前区块高度: ${blockNumber}`);
    }
    catch (error) {
        console.error('❌ 连接失败，请检查网络或 RPC 地址:', error);
    }
}

checkConnection();