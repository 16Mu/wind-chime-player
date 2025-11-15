/**
 * 启动性能诊断工具
 * 帮助定位启动慢的原因
 */

interface PerformanceCheckpoint {
  name: string;
  timestamp: number;
  duration?: number;
}

class PerformanceDiagnostics {
  private checkpoints: PerformanceCheckpoint[] = [];
  private startTime: number = 0;

  /**
   * 开始性能追踪
   */
  start() {
    this.startTime = performance.now();
    this.checkpoints = [];
    this.checkpoint('启动开始');
    console.log('🚀 [性能诊断] 启动性能追踪已开始');
  }

  /**
   * 记录检查点
   */
  checkpoint(name: string) {
    const now = performance.now();
    const duration = this.checkpoints.length > 0 
      ? now - this.checkpoints[this.checkpoints.length - 1].timestamp
      : now - this.startTime;
    
    this.checkpoints.push({
      name,
      timestamp: now,
      duration,
    });

    const totalTime = now - this.startTime;
    console.log(`⏱️ [性能] ${name}: +${duration.toFixed(0)}ms (总计: ${totalTime.toFixed(0)}ms)`);
  }

  /**
   * 生成性能报告
   */
  report() {
    const totalTime = performance.now() - this.startTime;
    
    console.log('\n📊 ========== 启动性能报告 ==========');
    console.log(`总耗时: ${totalTime.toFixed(0)}ms`);
    console.log('\n详细时间线:');
    
    this.checkpoints.forEach((checkpoint, index) => {
      const progress = ((checkpoint.timestamp - this.startTime) / totalTime * 100).toFixed(1);
      console.log(
        `${index + 1}. ${checkpoint.name.padEnd(30)} ` +
        `+${checkpoint.duration?.toFixed(0).padStart(4)}ms ` +
        `(${progress}%)`
      );
    });
    
    console.log('====================================\n');

    // 找出最慢的环节
    const slowest = [...this.checkpoints]
      .sort((a, b) => (b.duration || 0) - (a.duration || 0))
      .slice(0, 3);
    
    console.log('🐌 最慢的3个环节:');
    slowest.forEach((checkpoint, index) => {
      console.log(`${index + 1}. ${checkpoint.name}: ${checkpoint.duration?.toFixed(0)}ms`);
    });
    console.log('\n');

    return {
      totalTime,
      checkpoints: this.checkpoints,
      slowest,
    };
  }
}

export const perfDiag = new PerformanceDiagnostics();



