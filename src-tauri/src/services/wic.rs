//! WIC (Windows Imaging Component) based image processing

#[cfg(target_os = "windows")]
use std::path::Path;
#[cfg(target_os = "windows")]
use windows::{
    core::*,
    Win32::System::Com::*,
    Win32::Graphics::Imaging::*
};
use crate::utils::error::{AppError, AppResult};
#[cfg(target_os = "windows")]
use image::DynamicImage;

/// WIC Image Processor
pub struct WicProcessor {
    #[cfg(target_os = "windows")]
    factory: IWICImagingFactory,
}

impl WicProcessor {
    /// Create a new WIC processor instance
    #[cfg(target_os = "windows")]
    pub fn new() -> AppResult<Self> {
        unsafe {
            // Attempt to initialize COM.
            let _ = CoInitializeEx(None, COINIT_MULTITHREADED);

            let factory: IWICImagingFactory = CoCreateInstance(
                &CLSID_WICImagingFactory,
                None,
                CLSCTX_INPROC_SERVER
            ).map_err(|e| AppError::General(format!("Failed to create WIC Factory: {}", e)))?;

            Ok(Self { factory })
        }
    }

    #[cfg(not(target_os = "windows"))]
    pub fn new() -> AppResult<Self> {
        Err(AppError::General("WIC is only supported on Windows".into()))
    }

    /// Load and resize an image using WIC
    #[cfg(target_os = "windows")]
    pub fn load_and_resize(
        &self,
        path: &Path,
        target_width: u32,
        target_height: u32
    ) -> AppResult<(Vec<u8>, u32, u32)> {
        unsafe {
            let path_str = path.to_string_lossy();
            let mut path_wide: Vec<u16> = path_str.encode_utf16().collect();
            path_wide.push(0);

            // Create decoder from filename
            let decoder = self.factory.CreateDecoderFromFilename(
                PCWSTR(path_wide.as_ptr()),
                None,
                GENERIC_READ,
                WICDecodeMetadataCacheOnDemand,
            ).map_err(|e| AppError::General(format!("WIC Decoder Error: {}", e)))?;

            // Get first frame
            let frame = decoder.GetFrame(0)
                .map_err(|e| AppError::General(format!("WIC GetFrame Error: {}", e)))?;

            // Get original size
            let (orig_w, orig_h) = frame.GetSize()
                .map_err(|_| AppError::General("Failed to get frame size".into()))?;

            // Calculate scaling to maintain aspect ratio
            let scale = (target_width as f64 / orig_w as f64)
                .min(target_height as f64 / orig_h as f64);

            let new_w = (orig_w as f64 * scale).round() as u32;
            let new_h = (orig_h as f64 * scale).round() as u32;

            // Create scaler
            let scaler = self.factory.CreateBitmapScaler()
                .map_err(|_| AppError::General("Failed to create scaler".into()))?;

            scaler.Initialize(
                &frame,
                new_w,
                new_h,
                WICBitmapInterpolationModeHighQualityCubic,
            ).map_err(|e| AppError::General(format!("Scaler Initialize Error: {}", e)))?;

            // Create format converter (BGRA)
             let converter = self.factory.CreateFormatConverter()
                .map_err(|_| AppError::General("Failed to create converter".into()))?;

             converter.Initialize(
                &scaler,
                &GUID_WICPixelFormat32bppBGRA,
                WICBitmapDitherTypeNone,
                None,
                0.0,
                WICBitmapPaletteTypeMedianCut,
            ).map_err(|e| AppError::General(format!("Converter Initialize Error: {}", e)))?;

            let stride = new_w * 4;
            let buffer_size = (stride * new_h) as usize;
            let mut buffer = vec![0u8; buffer_size];

            converter.CopyPixels(None, stride, &mut buffer)?;

            Ok((buffer, new_w, new_h))
        }
    }

    #[cfg(not(target_os = "windows"))]
    pub fn load_and_resize(
        &self,
        _path: &std::path::Path,
        _target_width: u32,
        _target_height: u32
    ) -> AppResult<(Vec<u8>, u32, u32)> {
        Err(AppError::General("WIC is only supported on Windows".into()))
    }

    /// Helper to convert BGRA buffer to DynamicImage
    #[cfg(target_os = "windows")]
    pub fn buffer_to_dynamic_image(buffer: Vec<u8>, width: u32, height: u32) -> AppResult<DynamicImage> {
        // Convert BGRA to RGBA
        let mut rgba = buffer;
        for chunk in rgba.chunks_exact_mut(4) {
            let b = chunk[0];
            let r = chunk[2];
            chunk[0] = r;
            chunk[2] = b;
        }

        image::RgbaImage::from_raw(width, height, rgba)
            .map(DynamicImage::ImageRgba8)
            .ok_or_else(|| AppError::General("Failed to create RgbaImage from raw buffer".into()))
    }

    #[cfg(not(target_os = "windows"))]
    pub fn buffer_to_dynamic_image(_buffer: Vec<u8>, _width: u32, _height: u32) -> AppResult<image::DynamicImage> {
        Err(AppError::General("WIC is only supported on Windows".into()))
    }
}
