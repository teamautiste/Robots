#![allow(non_snake_case, non_camel_case_types, dead_code)]

use std::ffi::c_void;

pub const IMV_OK: i32 = 0;
pub const IMV_MAX_STRING_LENTH: usize = 256;
pub const IMV_MAX_DEVICE_ENUM_NUM: usize = 100;
pub const INFINITE_TIMEOUT: u32 = 0xFFFFFFFF;

pub type IMV_HANDLE = *mut c_void;
pub type IMV_FRAME_HANDLE = *mut c_void;

#[repr(i32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IMV_ECameraType {
    typeGigeCamera = 0,
    typeU3vCamera = 1,
    typeCLCamera = 2,
    typePCIeCamera = 3,
    typeUndefinedCamera = 255,
}

#[repr(i32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IMV_EInterfaceType {
    interfaceTypeGige = 0x00000001,
    interfaceTypeUsb3 = 0x00000002,
    interfaceTypeCL = 0x00000004,
    interfaceTypePCIe = 0x00000008,
    interfaceTypeAll = 0x00000000,
    interfaceInvalidType = -1,
}

#[repr(i32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IMV_ECreateHandleMode {
    modeByIndex = 0,
    modeByCameraKey = 1,
    modeByDeviceUserID = 2,
    modeByIPAddress = 3,
}

#[repr(i32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IMV_EGrabStrategy {
    grabStrartegySequential = 0,
    grabStrartegyLatestImage = 1,
    grabStrartegyUpcomingImage = 2,
    grabStrartegyUndefined = 3,
}

#[repr(i32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IMV_EPixelType {
    gvspPixelTypeUndefined = -1,
    gvspPixelMono8 = 0x01080001u32 as i32,
    gvspPixelBayGR8 = 0x01080008u32 as i32,
    gvspPixelBayRG8 = 0x01080009u32 as i32,
    gvspPixelBayGB8 = 0x0108000Au32 as i32,
    gvspPixelBayBG8 = 0x0108000Bu32 as i32,
    gvspPixelRGB8 = 0x02180014u32 as i32,
    gvspPixelBGR8 = 0x02180015u32 as i32,
}

#[repr(i32)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum IMV_EBayerDemosaic {
    demosaicNearestNeighbor = 0,
    demosaicBilinear = 1,
    demosaicEdgeSensing = 2,
    demosaicNotSupport = 255,
}

#[repr(C)]
#[derive(Debug, Clone)]
pub struct IMV_String {
    pub str: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
}

impl IMV_String {
    pub fn to_string_lossy(&self) -> String {
        let bytes: Vec<u8> = self.str.iter()
            .take_while(|&&c| c != 0)
            .map(|&c| c as u8)
            .collect();
        String::from_utf8_lossy(&bytes).to_string()
    }
}

#[repr(C)]
#[derive(Debug, Clone)]
pub struct IMV_GigEInterfaceInfo {
    pub description: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub macAddress: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub ipAddress: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub subnetMask: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub defaultGateWay: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub chReserved: [[std::os::raw::c_char; IMV_MAX_STRING_LENTH]; 5],
}

#[repr(C)]
#[derive(Debug, Clone)]
pub struct IMV_UsbInterfaceInfo {
    pub description: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub vendorID: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub deviceID: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub subsystemID: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub revision: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub speed: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub portID: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub chReserved: [[std::os::raw::c_char; IMV_MAX_STRING_LENTH]; 3],
}

#[repr(C)]
pub union IMV_InterfaceSpecificInfo {
    pub gigeInterfaceInfo: std::mem::ManuallyDrop<IMV_GigEInterfaceInfo>,
    pub usbInterfaceInfo: std::mem::ManuallyDrop<IMV_UsbInterfaceInfo>,
}

#[repr(C)]
#[derive(Debug, Clone)]
pub struct IMV_GigEDeviceInfo {
    pub macAddress: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub ipAddress: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub subnetMask: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub defaultGateWay: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub protocolVersion: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub reserved1: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub reserved2: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub reserved3: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub reserved4: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub ipConfiguration: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub chReserved: [[std::os::raw::c_char; IMV_MAX_STRING_LENTH]; 6],
}

#[repr(C)]
#[derive(Debug, Clone)]
pub struct IMV_UsbDeviceInfo {
    pub configurationValid: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub genCPVersion: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub u3vVersion: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub deviceGUID: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub familyName: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub u3vSerialNumber: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub speed: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub maxPower: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub chReserved: [[std::os::raw::c_char; IMV_MAX_STRING_LENTH]; 4],
}

#[repr(C)]
pub union IMV_DeviceSpecificInfo {
    pub gigeDeviceInfo: std::mem::ManuallyDrop<IMV_GigEDeviceInfo>,
    pub usbDeviceInfo: std::mem::ManuallyDrop<IMV_UsbDeviceInfo>,
}

#[repr(C)]
pub struct IMV_DeviceInfo {
    pub nCameraType: IMV_ECameraType,
    pub nCameraReserved: [i32; 5],
    pub cameraKey: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub cameraName: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub serialNumber: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub vendorName: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub modelName: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub manufactureInfo: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub deviceVersion: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub cameraReserved: [[std::os::raw::c_char; IMV_MAX_STRING_LENTH]; 5],
    pub DeviceSpecificInfo: IMV_DeviceSpecificInfo,
    pub nInterfaceType: IMV_EInterfaceType,
    pub nInterfaceReserved: [i32; 5],
    pub interfaceName: [std::os::raw::c_char; IMV_MAX_STRING_LENTH],
    pub interfaceReserved: [[std::os::raw::c_char; IMV_MAX_STRING_LENTH]; 5],
    pub InterfaceInfo: IMV_InterfaceSpecificInfo,
}

impl IMV_DeviceInfo {
    pub fn serial_number(&self) -> String {
        read_cstr(&self.serialNumber)
    }

    pub fn camera_key(&self) -> String {
        read_cstr(&self.cameraKey)
    }

    pub fn camera_name(&self) -> String {
        read_cstr(&self.cameraName)
    }

    pub fn vendor_name(&self) -> String {
        read_cstr(&self.vendorName)
    }

    pub fn model_name(&self) -> String {
        read_cstr(&self.modelName)
    }

    pub fn device_version(&self) -> String {
        read_cstr(&self.deviceVersion)
    }
}

#[repr(C)]
pub struct IMV_DeviceList {
    pub nDevNum: u32,
    pub pDevInfo: *mut IMV_DeviceInfo,
}

impl Default for IMV_DeviceList {
    fn default() -> Self {
        Self {
            nDevNum: 0,
            pDevInfo: std::ptr::null_mut(),
        }
    }
}

#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct IMV_FrameInfo {
    pub blockId: u64,
    pub status: u32,
    pub width: u32,
    pub height: u32,
    pub size: u32,
    pub pixelFormat: IMV_EPixelType,
    pub timeStamp: u64,
    pub chunkCount: u32,
    pub paddingX: u32,
    pub paddingY: u32,
    pub recvFrameTime: u32,
    pub nReserved: [u32; 19],
}

#[repr(C)]
pub struct IMV_Frame {
    pub frameHandle: IMV_FRAME_HANDLE,
    pub pData: *mut u8,
    pub frameInfo: IMV_FrameInfo,
    pub nReserved: [u32; 10],
}

impl Default for IMV_Frame {
    fn default() -> Self {
        unsafe { std::mem::zeroed() }
    }
}

#[repr(C)]
pub struct IMV_PixelConvertParam {
    pub nWidth: u32,
    pub nHeight: u32,
    pub ePixelFormat: IMV_EPixelType,
    pub pSrcData: *mut u8,
    pub nSrcDataLen: u32,
    pub nPaddingX: u32,
    pub nPaddingY: u32,
    pub eBayerDemosaic: IMV_EBayerDemosaic,
    pub eDstPixelFormat: IMV_EPixelType,
    pub pDstBuf: *mut u8,
    pub nDstBufSize: u32,
    pub nDstDataLen: u32,
    pub nReserved: [u32; 8],
}

pub type IMV_FrameCallBack = extern "C" fn(pFrame: *mut IMV_Frame, pUser: *mut c_void);

fn read_cstr(arr: &[std::os::raw::c_char]) -> String {
    let bytes: Vec<u8> = arr.iter()
        .take_while(|&&c| c != 0)
        .map(|&c| c as u8)
        .collect();
    String::from_utf8_lossy(&bytes).to_string()
}

#[link(name = "MVSDKmd", kind = "dylib")]
extern "system" {
    pub fn IMV_EnumDevices(pDeviceList: *mut IMV_DeviceList, interfaceType: u32) -> i32;

    pub fn IMV_CreateHandle(
        handle: *mut IMV_HANDLE,
        mode: IMV_ECreateHandleMode,
        pIdentifier: *mut c_void,
    ) -> i32;

    pub fn IMV_DestroyHandle(handle: IMV_HANDLE) -> i32;

    pub fn IMV_GetDeviceInfo(handle: IMV_HANDLE, pDevInfo: *mut IMV_DeviceInfo) -> i32;

    pub fn IMV_Open(handle: IMV_HANDLE) -> i32;

    pub fn IMV_IsOpen(handle: IMV_HANDLE) -> bool;

    pub fn IMV_Close(handle: IMV_HANDLE) -> i32;

    pub fn IMV_StartGrabbing(handle: IMV_HANDLE) -> i32;

    pub fn IMV_StartGrabbingEx(
        handle: IMV_HANDLE,
        maxImagesGrabbed: u64,
        strategy: IMV_EGrabStrategy,
    ) -> i32;

    pub fn IMV_IsGrabbing(handle: IMV_HANDLE) -> bool;

    pub fn IMV_StopGrabbing(handle: IMV_HANDLE) -> i32;

    pub fn IMV_AttachGrabbing(
        handle: IMV_HANDLE,
        proc: IMV_FrameCallBack,
        pUser: *mut c_void,
    ) -> i32;

    pub fn IMV_GetFrame(
        handle: IMV_HANDLE,
        pFrame: *mut IMV_Frame,
        timeoutMS: u32,
    ) -> i32;

    pub fn IMV_ReleaseFrame(handle: IMV_HANDLE, pFrame: *mut IMV_Frame) -> i32;

    pub fn IMV_PixelConvert(
        handle: IMV_HANDLE,
        pstPixelConvertParam: *mut IMV_PixelConvertParam,
    ) -> i32;
}
