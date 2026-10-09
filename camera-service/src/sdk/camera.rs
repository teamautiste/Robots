use super::bindings::*;
use anyhow::{anyhow, Result};
use image::codecs::jpeg::JpegEncoder;
use image::{ColorType, ImageEncoder};
use std::ffi::c_void;

#[derive(Clone, Debug)]
pub struct Device {
    pub index: u32,
    pub serial: String,
    pub model: String,
    pub name: String,
}

pub fn enumerate() -> Result<Vec<Device>> {
    let mut list = IMV_DeviceList::default();
    let code = unsafe { IMV_EnumDevices(&mut list, 0x00000002) };
    check(code, "enumerar dispositivos")?;
    if list.pDevInfo.is_null() && list.nDevNum > 0 { return Err(anyhow!("SDK devolvió una lista de dispositivos inválida")); }
    let devices = unsafe { std::slice::from_raw_parts(list.pDevInfo, list.nDevNum as usize) };
    Ok(devices.iter().enumerate().filter_map(|(index, item)| {
        let serial = item.serial_number();
        if serial.is_empty() { None } else { Some(Device { index: index as u32, serial, model: item.model_name(), name: item.camera_name() }) }
    }).collect())
}

pub struct Camera {
    handle: IMV_HANDLE,
    grabbing: bool,
}

unsafe impl Send for Camera {}

impl Camera {
    pub fn open(index: u32) -> Result<Self> {
        let mut handle = std::ptr::null_mut();
        check(unsafe { IMV_CreateHandle(&mut handle, IMV_ECreateHandleMode::modeByIndex, (&index as *const u32).cast_mut().cast::<c_void>()) }, "crear handle")?;
        if let Err(error) = check(unsafe { IMV_Open(handle) }, "abrir cámara") { unsafe { IMV_DestroyHandle(handle); } return Err(error); }
        Ok(Self { handle, grabbing: false })
    }

    pub fn start(&mut self) -> Result<()> {
        if !self.grabbing { check(unsafe { IMV_StartGrabbing(handle(self.handle)) }, "iniciar captura")?; self.grabbing = true; }
        Ok(())
    }

    pub fn frame_jpeg(&mut self) -> Result<(Vec<u8>, u32, u32)> {
        let mut frame = IMV_Frame::default();
        check(unsafe { IMV_GetFrame(handle(self.handle), &mut frame, 1000) }, "obtener frame")?;
        let result = self.encode_frame(&frame);
        let release = unsafe { IMV_ReleaseFrame(handle(self.handle), &mut frame) };
        if let Err(error) = check(release, "liberar frame") { return Err(error); }
        result
    }

    fn encode_frame(&self, frame: &IMV_Frame) -> Result<(Vec<u8>, u32, u32)> {
        let info = frame.frameInfo;
        if frame.pData.is_null() || info.width == 0 || info.height == 0 { return Err(anyhow!("frame vacío")); }
        let pixels = info.width.checked_mul(info.height).ok_or_else(|| anyhow!("dimensiones inválidas"))? as usize;
        let mut bgr = vec![0u8; pixels.checked_mul(3).ok_or_else(|| anyhow!("frame demasiado grande"))?];
        let mut convert = IMV_PixelConvertParam {
            nWidth: info.width, nHeight: info.height, ePixelFormat: info.pixelFormat, pSrcData: frame.pData,
            nSrcDataLen: info.size, nPaddingX: info.paddingX, nPaddingY: info.paddingY,
            eBayerDemosaic: IMV_EBayerDemosaic::demosaicBilinear, eDstPixelFormat: IMV_EPixelType::gvspPixelBGR8,
            pDstBuf: bgr.as_mut_ptr(), nDstBufSize: bgr.len() as u32, nDstDataLen: 0, nReserved: [0; 8],
        };
        check(unsafe { IMV_PixelConvert(handle(self.handle), &mut convert) }, "convertir píxeles")?;
        let converted = convert.nDstDataLen as usize;
        if converted != bgr.len() { return Err(anyhow!("conversión incompleta del frame")); }
        for pixel in bgr.chunks_exact_mut(3) { pixel.swap(0, 2); }
        let mut jpeg = Vec::new();
        JpegEncoder::new_with_quality(&mut jpeg, 80).write_image(&bgr, info.width, info.height, ColorType::Rgb8.into())?;
        Ok((jpeg, info.width, info.height))
    }

    pub fn stop(&mut self) -> Result<()> {
        if self.grabbing { check(unsafe { IMV_StopGrabbing(handle(self.handle)) }, "detener captura")?; self.grabbing = false; }
        Ok(())
    }
}

impl Drop for Camera {
    fn drop(&mut self) { let _ = self.stop(); unsafe { IMV_Close(handle(self.handle)); IMV_DestroyHandle(self.handle); } }
}

fn handle(value: IMV_HANDLE) -> IMV_HANDLE { value }
fn check(code: i32, operation: &str) -> Result<()> { if code == IMV_OK { Ok(()) } else { Err(anyhow!("No se pudo {operation}")) } }
