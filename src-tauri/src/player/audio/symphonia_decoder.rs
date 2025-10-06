// Symphonia 流式解码器
// 
// 优势：
// - 不需要 seek 支持
// - 边读边解码
// - 真正的流式播放

use symphonia::core::formats::{FormatReader, Packet};
use symphonia::core::codecs::Decoder;
use symphonia::core::audio::SampleBuffer;
use symphonia::core::errors::Error as SymphoniaError;
use std::sync::{Arc, Mutex};

/// Symphonia 流式解码器（实现 rodio::Source）
pub struct SymphoniaDecoder {
    format: Arc<Mutex<Box<dyn FormatReader>>>,
    decoder: Arc<Mutex<Box<dyn Decoder>>>,
    track_id: u32,
    sample_buffer: Option<SampleBuffer<i16>>,
    sample_index: usize,
    channels: u16,
    sample_rate: u32,
}

impl SymphoniaDecoder {
    pub fn new(
        format: Box<dyn FormatReader>,
        decoder: Box<dyn Decoder>,
        track_id: u32,
    ) -> Self {
        let codec_params = &decoder.codec_params();
        let channels = codec_params.channels.map(|c| c.count() as u16).unwrap_or(2);
        let sample_rate = codec_params.sample_rate.unwrap_or(44100);
        
        log::info!("🎵 SymphoniaDecoder 创建: {}Hz, {}通道", sample_rate, channels);
        
        Self {
            format: Arc::new(Mutex::new(format)),
            decoder: Arc::new(Mutex::new(decoder)),
            track_id,
            sample_buffer: None,
            sample_index: 0,
            channels,
            sample_rate,
        }
    }
    
    /// 解码下一个数据包
    fn decode_next_packet(&mut self) -> Result<(), SymphoniaError> {
        let mut format = self.format.lock().unwrap();
        let mut decoder = self.decoder.lock().unwrap();
        
        loop {
            // 读取下一个数据包
            let packet = match format.next_packet() {
                Ok(packet) => packet,
                Err(e) => return Err(e),
            };
            
            // 只解码我们的音轨
            if packet.track_id() != self.track_id {
                continue;
            }
            
            // 解码数据包
            let decoded = decoder.decode(&packet)?;
            
            // 创建或复用样本缓冲
            if self.sample_buffer.is_none() {
                let spec = *decoded.spec();
                let duration = decoded.capacity() as u64;
                self.sample_buffer = Some(SampleBuffer::new(duration, spec));
            }
            
            // 复制解码后的样本
            if let Some(ref mut buf) = self.sample_buffer {
                buf.copy_interleaved_ref(decoded);
                self.sample_index = 0;
            }
            
            return Ok(());
        }
    }
}

impl Iterator for SymphoniaDecoder {
    type Item = i16;
    
    fn next(&mut self) -> Option<Self::Item> {
        loop {
            // 如果有缓存的样本，直接返回
            if let Some(ref buf) = self.sample_buffer {
                if self.sample_index < buf.len() {
                    let sample = buf.samples()[self.sample_index];
                    self.sample_index += 1;
                    return Some(sample);
                }
            }
            
            // 解码下一个数据包
            match self.decode_next_packet() {
                Ok(_) => continue,
                Err(SymphoniaError::IoError(e)) if e.kind() == std::io::ErrorKind::UnexpectedEof => {
                    // 正常结束
                    return None;
                }
                Err(SymphoniaError::ResetRequired) => {
                    // 需要重置解码器
                    log::warn!("⚠️ 解码器需要重置");
                    return None;
                }
                Err(e) => {
                    log::error!("❌ 解码错误: {}", e);
                    return None;
                }
            }
        }
    }
}

impl rodio::Source for SymphoniaDecoder {
    fn current_frame_len(&self) -> Option<usize> {
        None // 流式播放，长度未知
    }
    
    fn channels(&self) -> u16 {
        self.channels
    }
    
    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }
    
    fn total_duration(&self) -> Option<std::time::Duration> {
        None // 流式播放，总时长未知
    }
}



















