// 1. 导入 Token 类
// @uniswap/sdk-core 是 Uniswap 所有版本的底层库，负责处理代币定义、金额转换、货币对逻辑。
import {Token} from "@uniswap/sdk-core";

// 2. 设置链环境
// 1 代表 Ethereum Mainnet。如果你想在 Sepolia 测试网跑，这里要改。
const chainId = 1;

// 3. 实例化 WETH
const WETH = new Token(
    chainId,                                      // 链 ID
    '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // 合约地址：这是 WETH 在主网的真实地址
    18,                                           // 精度：WETH 是 18 位
    'WETH',                                       // 符号：用于 UI 显示
    'Wrapped Ether'                               // 全称
);

// 4. 实例化 USDC
const USDC = new Token(
    chainId,
    '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC 地址
    6,                                            // ⚠️ 注意：USDC 只有 6 位精度
    'USDC',
    'USD Coin'
);

console.log('已经初始化代币', WETH.symbol, "和", USDC.symbol);
