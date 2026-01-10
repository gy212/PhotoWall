//! 色彩空间转换工具
//!
//! 提供专业级图像处理所需的色彩空间转换函数

/// D65 白点 XYZ 值
pub const D65_WHITE: [f32; 3] = [0.95047, 1.0, 1.08883];

/// sRGB 转线性 RGB (移除 gamma)
#[inline]
pub fn srgb_to_linear(c: f32) -> f32 {
    if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    }
}

/// 线性 RGB 转 sRGB (应用 gamma)
#[inline]
pub fn linear_to_srgb(c: f32) -> f32 {
    if c <= 0.0031308 {
        c * 12.92
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    }
}

/// sRGB 转线性 RGB (批量)
#[inline]
pub fn srgb_to_linear_rgb(r: f32, g: f32, b: f32) -> (f32, f32, f32) {
    (srgb_to_linear(r), srgb_to_linear(g), srgb_to_linear(b))
}

/// 线性 RGB 转 sRGB (批量)
#[inline]
pub fn linear_to_srgb_rgb(r: f32, g: f32, b: f32) -> (f32, f32, f32) {
    (linear_to_srgb(r), linear_to_srgb(g), linear_to_srgb(b))
}

/// 线性 RGB 转 CIE XYZ (D65)
#[inline]
pub fn rgb_to_xyz(r: f32, g: f32, b: f32) -> (f32, f32, f32) {
    // sRGB to XYZ matrix (D65)
    let x = 0.4124564 * r + 0.3575761 * g + 0.1804375 * b;
    let y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b;
    let z = 0.0193339 * r + 0.1191920 * g + 0.9503041 * b;
    (x, y, z)
}

/// CIE XYZ 转线性 RGB (D65)
#[inline]
pub fn xyz_to_rgb(x: f32, y: f32, z: f32) -> (f32, f32, f32) {
    // XYZ to sRGB matrix (D65)
    let r = 3.2404542 * x - 1.5371385 * y - 0.4985314 * z;
    let g = -0.9692660 * x + 1.8760108 * y + 0.0415560 * z;
    let b = 0.0556434 * x - 0.2040259 * y + 1.0572252 * z;
    (r, g, b)
}

/// CIE XYZ 转 CIE Lab
#[inline]
pub fn xyz_to_lab(x: f32, y: f32, z: f32) -> (f32, f32, f32) {
    let xn = x / D65_WHITE[0];
    let yn = y / D65_WHITE[1];
    let zn = z / D65_WHITE[2];

    let fx = lab_f(xn);
    let fy = lab_f(yn);
    let fz = lab_f(zn);

    let l = 116.0 * fy - 16.0;
    let a = 500.0 * (fx - fy);
    let b = 200.0 * (fy - fz);

    (l, a, b)
}

/// CIE Lab 转 CIE XYZ
#[inline]
pub fn lab_to_xyz(l: f32, a: f32, b: f32) -> (f32, f32, f32) {
    let fy = (l + 16.0) / 116.0;
    let fx = a / 500.0 + fy;
    let fz = fy - b / 200.0;

    let xn = lab_f_inv(fx);
    let yn = lab_f_inv(fy);
    let zn = lab_f_inv(fz);

    (xn * D65_WHITE[0], yn * D65_WHITE[1], zn * D65_WHITE[2])
}

/// Lab 转换辅助函数
#[inline]
fn lab_f(t: f32) -> f32 {
    const DELTA: f32 = 6.0 / 29.0;
    const DELTA_CUBE: f32 = DELTA * DELTA * DELTA;

    if t > DELTA_CUBE {
        t.cbrt()
    } else {
        t / (3.0 * DELTA * DELTA) + 4.0 / 29.0
    }
}

/// Lab 逆转换辅助函数
#[inline]
fn lab_f_inv(t: f32) -> f32 {
    const DELTA: f32 = 6.0 / 29.0;

    if t > DELTA {
        t * t * t
    } else {
        3.0 * DELTA * DELTA * (t - 4.0 / 29.0)
    }
}

/// sRGB 转 Lab (便捷函数)
#[inline]
pub fn srgb_to_lab(r: f32, g: f32, b: f32) -> (f32, f32, f32) {
    let (lr, lg, lb) = srgb_to_linear_rgb(r, g, b);
    let (x, y, z) = rgb_to_xyz(lr, lg, lb);
    xyz_to_lab(x, y, z)
}

/// Lab 转 sRGB (便捷函数)
#[inline]
pub fn lab_to_srgb(l: f32, a: f32, b: f32) -> (f32, f32, f32) {
    let (x, y, z) = lab_to_xyz(l, a, b);
    let (lr, lg, lb) = xyz_to_rgb(x, y, z);
    linear_to_srgb_rgb(lr, lg, lb)
}

/// 计算亮度 (Rec. 709)
#[inline]
pub fn luminance(r: f32, g: f32, b: f32) -> f32 {
    0.2126 * r + 0.7152 * g + 0.0722 * b
}

/// 计算亮度 (从 sRGB，先转线性)
#[inline]
pub fn luminance_srgb(r: f32, g: f32, b: f32) -> f32 {
    let (lr, lg, lb) = srgb_to_linear_rgb(r, g, b);
    luminance(lr, lg, lb)
}

// ============ 色温相关 ============

/// 开尔文温度转 xy 色度坐标 (Planckian locus)
/// 有效范围: 1667K - 25000K
pub fn kelvin_to_xy(t: f32) -> (f32, f32) {
    let t = t.clamp(1667.0, 25000.0);
    let t2 = t * t;
    let t3 = t2 * t;

    let x = if t <= 4000.0 {
        -0.2661239e9 / t3 - 0.2343589e6 / t2 + 0.8776956e3 / t + 0.179910
    } else {
        -3.0258469e9 / t3 + 2.1070379e6 / t2 + 0.2226347e3 / t + 0.24039
    };

    let x2 = x * x;
    let x3 = x2 * x;

    let y = if t <= 2222.0 {
        -1.1063814 * x3 - 1.34811020 * x2 + 2.18555832 * x - 0.20219683
    } else if t <= 4000.0 {
        -0.9549476 * x3 - 1.37418593 * x2 + 2.09137015 * x - 0.16748867
    } else {
        3.0817580 * x3 - 5.87338670 * x2 + 3.75112997 * x - 0.37001483
    };

    (x, y)
}

/// xy 色度坐标转 XYZ (Y=1)
#[inline]
pub fn xy_to_xyz(x: f32, y: f32) -> (f32, f32, f32) {
    if y == 0.0 {
        return (0.0, 0.0, 0.0);
    }
    (x / y, 1.0, (1.0 - x - y) / y)
}

/// Bradford 色彩适应矩阵
const BRADFORD_MA: [[f32; 3]; 3] = [
    [0.8951, 0.2664, -0.1614],
    [-0.7502, 1.7135, 0.0367],
    [0.0389, -0.0685, 1.0296],
];

/// Bradford 逆矩阵
const BRADFORD_MA_INV: [[f32; 3]; 3] = [
    [0.9869929, -0.1470543, 0.1599627],
    [0.4323053, 0.5183603, 0.0492912],
    [-0.0085287, 0.0400428, 0.9684867],
];

/// 3x3 矩阵乘向量
#[inline]
fn mat3_mul_vec3(m: &[[f32; 3]; 3], v: [f32; 3]) -> [f32; 3] {
    [
        m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2],
        m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2],
        m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2],
    ]
}

/// Bradford 色彩适应
/// 将颜色从源白点适应到目标白点
pub fn bradford_adapt(rgb: [f32; 3], src_white_xyz: [f32; 3], dst_white_xyz: [f32; 3]) -> [f32; 3] {
    // 转换到 LMS 空间
    let src_lms = mat3_mul_vec3(&BRADFORD_MA, src_white_xyz);
    let dst_lms = mat3_mul_vec3(&BRADFORD_MA, dst_white_xyz);

    // 计算缩放因子
    let scale = [
        if src_lms[0] != 0.0 { dst_lms[0] / src_lms[0] } else { 1.0 },
        if src_lms[1] != 0.0 { dst_lms[1] / src_lms[1] } else { 1.0 },
        if src_lms[2] != 0.0 { dst_lms[2] / src_lms[2] } else { 1.0 },
    ];

    // RGB -> XYZ
    let (x, y, z) = rgb_to_xyz(rgb[0], rgb[1], rgb[2]);

    // XYZ -> LMS
    let lms = mat3_mul_vec3(&BRADFORD_MA, [x, y, z]);

    // 应用缩放
    let adapted_lms = [lms[0] * scale[0], lms[1] * scale[1], lms[2] * scale[2]];

    // LMS -> XYZ
    let adapted_xyz = mat3_mul_vec3(&BRADFORD_MA_INV, adapted_lms);

    // XYZ -> RGB
    let (r, g, b) = xyz_to_rgb(adapted_xyz[0], adapted_xyz[1], adapted_xyz[2]);
    [r, g, b]
}

/// 根据色温调整颜色
/// value: -100 到 100，0 表示 6500K (D65)
/// 负值偏冷（蓝），正值偏暖（黄/橙）
pub fn adjust_temperature_value(rgb: [f32; 3], value: i32) -> [f32; 3] {
    if value == 0 {
        return rgb;
    }

    // 映射 value 到开尔文温度
    // -100 -> 10000K (冷), 0 -> 6500K, +100 -> 3000K (暖)
    let kelvin = if value > 0 {
        6500.0 - (value as f32 / 100.0) * 3500.0 // 6500 -> 3000
    } else {
        6500.0 - (value as f32 / 100.0) * 3500.0 // 6500 -> 10000
    };

    let (src_x, src_y) = kelvin_to_xy(6500.0); // D65
    let (dst_x, dst_y) = kelvin_to_xy(kelvin);

    let src_xyz = xy_to_xyz(src_x, src_y);
    let dst_xyz = xy_to_xyz(dst_x, dst_y);

    bradford_adapt(rgb, [src_xyz.0, src_xyz.1, src_xyz.2], [dst_xyz.0, dst_xyz.1, dst_xyz.2])
}

// ============ 色调曲线 ============

/// Sigmoid 软过渡曲线
/// x: 输入值 (0-1)
/// pivot: 过渡中心点
/// strength: 强度 (-1 到 1)
#[inline]
pub fn soft_rolloff(x: f32, pivot: f32, strength: f32) -> f32 {
    if strength == 0.0 {
        return x;
    }

    let k = 8.0 * strength.abs(); // 过渡锐度
    let sigmoid = 1.0 / (1.0 + (-k * (x - pivot)).exp());

    if strength > 0.0 {
        // 提亮
        x + (1.0 - x) * sigmoid * strength
    } else {
        // 压暗
        x * (1.0 - sigmoid * strength.abs())
    }
}

/// Filmic 色调映射曲线
/// 用于曝光调整时保护高光
#[inline]
pub fn filmic_tonemap(x: f32) -> f32 {
    if x <= 0.0 {
        0.0
    } else if x >= 1.0 {
        // 软压缩高光
        1.0 - (-x).exp() * 0.5
    } else {
        x
    }
}

/// 带高光保护的曝光调整
#[inline]
pub fn exposure_with_protection(x: f32, ev: f32) -> f32 {
    let factor = 2.0_f32.powf(ev);
    let result = x * factor;

    if result > 1.0 {
        // 使用 filmic 曲线软压缩
        1.0 - (-(result - 1.0) * 2.0).exp() * (result - 1.0).min(0.5)
    } else {
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gamma_roundtrip() {
        for i in 0..=255 {
            let c = i as f32 / 255.0;
            let linear = srgb_to_linear(c);
            let back = linear_to_srgb(linear);
            assert!((c - back).abs() < 0.001, "Gamma roundtrip failed for {}", c);
        }
    }

    #[test]
    fn test_lab_roundtrip() {
        let test_colors = [
            (1.0, 0.0, 0.0), // Red
            (0.0, 1.0, 0.0), // Green
            (0.0, 0.0, 1.0), // Blue
            (0.5, 0.5, 0.5), // Gray
        ];

        for (r, g, b) in test_colors {
            let (l, a, b_lab) = srgb_to_lab(r, g, b);
            let (r2, g2, b2) = lab_to_srgb(l, a, b_lab);
            assert!((r - r2).abs() < 0.01, "Lab roundtrip failed for R");
            assert!((g - g2).abs() < 0.01, "Lab roundtrip failed for G");
            assert!((b - b2).abs() < 0.01, "Lab roundtrip failed for B");
        }
    }

    #[test]
    fn test_temperature_neutral() {
        let rgb = [0.5, 0.5, 0.5];
        let result = adjust_temperature_value(rgb, 0);
        assert!((rgb[0] - result[0]).abs() < 0.001);
        assert!((rgb[1] - result[1]).abs() < 0.001);
        assert!((rgb[2] - result[2]).abs() < 0.001);
    }
}
