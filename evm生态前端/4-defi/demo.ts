import { parseUnits } from 'viem';

async function unblockAccount() {
  console.log('--- 正在执行阻塞清理：强制覆盖 Nonce 32 ---');

  // 1. 获取当前网络建议的 Gas 价格并翻倍，确保“暴力插队”
  const gasPrice = await publicClient.getGasPrice();
  const fastGasPrice = (gasPrice * 2n); // 翻倍处理

  try {
    const hash = await walletClient.sendTransaction({
      to: account.address, // 发给自己
      value: 0n,           // 转账 0 ETH
      nonce: 32,           // 强制指定为阻塞的那个 Nonce
      maxFeePerGas: fastGasPrice,
      maxPriorityFeePerGas: parseUnits('2', 'gwei'), // 给矿工的小费设高点
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

unblockAccount();