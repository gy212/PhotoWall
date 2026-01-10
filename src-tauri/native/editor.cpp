/**
 * PhotoWall Native Editor Implementation
 *
 * 使用 libvips 实现专业级图像处理
 */

#define PW_EDITOR_EXPORTS
#include "editor.h"
#include <vips/vips.h>
#include <cmath>
#include <cstring>
#include <string>
#include <algorithm>

// 线程局部错误信息
static thread_local std::string g_last_error;

// 设置错误信息
static void set_error(const char* msg) {
    g_last_error = msg ? msg : "Unknown error";
}

// ============ 色彩空间工具 ============

// sRGB 转线性
static inline float srgb_to_linear(float c) {
    if (c <= 0.04045f) {
        return c / 12.92f;
    }
    return std::pow((c + 0.055f) / 1.055f, 2.4f);
}

// 线性转 sRGB
static inline float linear_to_srgb(float c) {
    if (c <= 0.0031308f) {
        return c * 12.92f;
    }
    return 1.055f * std::pow(c, 1.0f / 2.4f) - 0.055f;
}

// 计算亮度
static inline float luminance(float r, float g, float b) {
    return 0.2126f * r + 0.7152f * g + 0.0722f * b;
}

// Clamp 函数
template<typename T>
static inline T clamp(T val, T min_val, T max_val) {
    return std::max(min_val, std::min(max_val, val));
}

// ============ 公共 API ============

PW_API int pw_editor_init(void) {
    if (VIPS_INIT("photowall")) {
        set_error(vips_error_buffer());
        vips_error_clear();
        return -1;
    }
    return 0;
}

PW_API void pw_editor_cleanup(void) {
    vips_shutdown();
}

PW_API const char* pw_get_last_error(void) {
    return g_last_error.c_str();
}

// ============ 模糊 ============

PW_API int pw_blur(const char* input_path, const char* output_path, float sigma) {
    VipsImage* in = nullptr;
    VipsImage* out = nullptr;
    int result = -1;

    if (!(in = vips_image_new_from_file(input_path, nullptr))) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    if (vips_gaussblur(in, &out, sigma, nullptr)) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    if (vips_image_write_to_file(out, output_path, nullptr)) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    result = 0;

cleanup:
    if (out) g_object_unref(out);
    if (in) g_object_unref(in);
    return result;
}

// ============ 锐化 ============

PW_API int pw_sharpen(const char* input_path, const char* output_path, float sigma, float amount) {
    VipsImage* in = nullptr;
    VipsImage* out = nullptr;
    int result = -1;

    if (!(in = vips_image_new_from_file(input_path, nullptr))) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    // libvips sharpen: sigma 控制半径, x1/y2/y3 控制强度
    if (vips_sharpen(in, &out, "sigma", sigma, "x1", 2.0, "y2", amount, "y3", amount * 2, nullptr)) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    if (vips_image_write_to_file(out, output_path, nullptr)) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    result = 0;

cleanup:
    if (out) g_object_unref(out);
    if (in) g_object_unref(in);
    return result;
}

// ============ 曝光调整 ============

// 像素处理回调 - 曝光
static int exposure_pixel_fn(VipsRegion* in_region, VipsRegion* out_region,
                             int n_bands, void* user_data) {
    float ev = *static_cast<float*>(user_data);
    float factor = std::pow(2.0f, ev);

    VipsRect* r = &out_region->valid;
    int width = r->width;
    int height = r->height;

    for (int y = 0; y < height; y++) {
        unsigned char* p = VIPS_REGION_ADDR(in_region, r->left, r->top + y);
        unsigned char* q = VIPS_REGION_ADDR(out_region, r->left, r->top + y);

        for (int x = 0; x < width; x++) {
            for (int b = 0; b < 3 && b < n_bands; b++) {
                float linear = srgb_to_linear(p[b] / 255.0f);
                float exposed = linear * factor;

                // Filmic 高光保护
                if (exposed > 1.0f) {
                    exposed = 1.0f - std::exp(-(exposed - 1.0f) * 2.0f) * 0.5f;
                }

                float result = linear_to_srgb(clamp(exposed, 0.0f, 1.0f));
                q[b] = static_cast<unsigned char>(clamp(result * 255.0f, 0.0f, 255.0f));
            }
            // 复制 alpha 通道
            if (n_bands > 3) {
                q[3] = p[3];
            }
            p += n_bands;
            q += n_bands;
        }
    }
    return 0;
}

PW_API int pw_adjust_exposure(const char* input_path, const char* output_path, float ev) {
    VipsImage* in = nullptr;
    VipsImage* out = nullptr;
    int result = -1;

    if (!(in = vips_image_new_from_file(input_path, nullptr))) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    // 使用 vips_linear 进行简单的曝光调整
    // 更精确的实现需要自定义操作
    {
        double a[] = {std::pow(2.0, ev), std::pow(2.0, ev), std::pow(2.0, ev)};
        double b[] = {0, 0, 0};

        if (vips_linear(in, &out, a, b, 3, nullptr)) {
            set_error(vips_error_buffer());
            vips_error_clear();
            goto cleanup;
        }
    }

    if (vips_image_write_to_file(out, output_path, nullptr)) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    result = 0;

cleanup:
    if (out) g_object_unref(out);
    if (in) g_object_unref(in);
    return result;
}

// ============ 高光调整 ============

PW_API int pw_adjust_highlights(const char* input_path, const char* output_path, float amount) {
    VipsImage* in = nullptr;
    VipsImage* lab = nullptr;
    VipsImage* adjusted = nullptr;
    VipsImage* out = nullptr;
    int result = -1;

    if (!(in = vips_image_new_from_file(input_path, nullptr))) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    // 转换到 Lab 色彩空间
    if (vips_colourspace(in, &lab, VIPS_INTERPRETATION_LAB, nullptr)) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    // 使用 tonelut 进行高光调整
    // 简化实现：使用 linear 调整亮通道
    {
        // 提取 L 通道，调整后合并
        // 这里使用简化的方法
        double strength = amount / 100.0;
        double a[] = {1.0 - strength * 0.3, 1.0, 1.0};
        double b[] = {strength * 20.0, 0, 0};

        if (vips_linear(lab, &adjusted, a, b, 3, nullptr)) {
            set_error(vips_error_buffer());
            vips_error_clear();
            goto cleanup;
        }
    }

    // 转回 sRGB
    if (vips_colourspace(adjusted, &out, VIPS_INTERPRETATION_sRGB, nullptr)) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    if (vips_image_write_to_file(out, output_path, nullptr)) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    result = 0;

cleanup:
    if (out) g_object_unref(out);
    if (adjusted) g_object_unref(adjusted);
    if (lab) g_object_unref(lab);
    if (in) g_object_unref(in);
    return result;
}

// ============ 阴影调整 ============

PW_API int pw_adjust_shadows(const char* input_path, const char* output_path, float amount) {
    VipsImage* in = nullptr;
    VipsImage* lab = nullptr;
    VipsImage* adjusted = nullptr;
    VipsImage* out = nullptr;
    int result = -1;

    if (!(in = vips_image_new_from_file(input_path, nullptr))) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    if (vips_colourspace(in, &lab, VIPS_INTERPRETATION_LAB, nullptr)) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    {
        double strength = amount / 100.0;
        // 阴影提亮：增加暗部的 L 值
        double a[] = {1.0 + strength * 0.2, 1.0, 1.0};
        double b[] = {strength * 15.0, 0, 0};

        if (vips_linear(lab, &adjusted, a, b, 3, nullptr)) {
            set_error(vips_error_buffer());
            vips_error_clear();
            goto cleanup;
        }
    }

    if (vips_colourspace(adjusted, &out, VIPS_INTERPRETATION_sRGB, nullptr)) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    if (vips_image_write_to_file(out, output_path, nullptr)) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    result = 0;

cleanup:
    if (out) g_object_unref(out);
    if (adjusted) g_object_unref(adjusted);
    if (lab) g_object_unref(lab);
    if (in) g_object_unref(in);
    return result;
}

// ============ 色温调整 ============

PW_API int pw_adjust_temperature(const char* input_path, const char* output_path, float kelvin_shift) {
    VipsImage* in = nullptr;
    VipsImage* out = nullptr;
    int result = -1;

    if (!(in = vips_image_new_from_file(input_path, nullptr))) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    // 使用 vips_linear 调整 RGB 通道
    // 暖色调：增加 R，减少 B
    // 冷色调：减少 R，增加 B
    {
        double shift = kelvin_shift / 100.0;
        double r_mult = 1.0 + shift * 0.15;
        double b_mult = 1.0 - shift * 0.15;
        double a[] = {r_mult, 1.0, b_mult};
        double b[] = {0, 0, 0};

        if (vips_linear(in, &out, a, b, 3, nullptr)) {
            set_error(vips_error_buffer());
            vips_error_clear();
            goto cleanup;
        }
    }

    if (vips_image_write_to_file(out, output_path, nullptr)) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    result = 0;

cleanup:
    if (out) g_object_unref(out);
    if (in) g_object_unref(in);
    return result;
}

// ============ 综合调整 ============

PW_API int pw_apply_adjustments(
    const char* input_path,
    const char* output_path,
    const PwAdjustments* adj,
    int quality
) {
    VipsImage* current = nullptr;
    VipsImage* next = nullptr;
    int result = -1;

    if (!(current = vips_image_new_from_file(input_path, nullptr))) {
        set_error(vips_error_buffer());
        vips_error_clear();
        goto cleanup;
    }

    // 应用曝光
    if (std::abs(adj->exposure) > 0.01f) {
        double ev = adj->exposure / 100.0;
        double factor = std::pow(2.0, ev);
        double a[] = {factor, factor, factor};
        double b[] = {0, 0, 0};

        if (vips_linear(current, &next, a, b, 3, nullptr)) {
            set_error(vips_error_buffer());
            vips_error_clear();
            goto cleanup;
        }
        g_object_unref(current);
        current = next;
        next = nullptr;
    }

    // 应用亮度
    if (std::abs(adj->brightness) > 0.01f) {
        double shift = adj->brightness / 100.0 * 50.0;
        double a[] = {1, 1, 1};
        double b[] = {shift, shift, shift};

        if (vips_linear(current, &next, a, b, 3, nullptr)) {
            set_error(vips_error_buffer());
            vips_error_clear();
            goto cleanup;
        }
        g_object_unref(current);
        current = next;
        next = nullptr;
    }

    // 应用对比度
    if (std::abs(adj->contrast) > 0.01f) {
        double factor = 1.0 + adj->contrast / 100.0;
        double a[] = {factor, factor, factor};
        double b[] = {128 * (1 - factor), 128 * (1 - factor), 128 * (1 - factor)};

        if (vips_linear(current, &next, a, b, 3, nullptr)) {
            set_error(vips_error_buffer());
            vips_error_clear();
            goto cleanup;
        }
        g_object_unref(current);
        current = next;
        next = nullptr;
    }

    // 应用饱和度
    if (std::abs(adj->saturation) > 0.01f) {
        VipsImage* lab = nullptr;
        VipsImage* adjusted = nullptr;

        if (vips_colourspace(current, &lab, VIPS_INTERPRETATION_LAB, nullptr)) {
            set_error(vips_error_buffer());
            vips_error_clear();
            goto cleanup;
        }

        double sat_factor = 1.0 + adj->saturation / 100.0;
        double a[] = {1.0, sat_factor, sat_factor};
        double b[] = {0, 0, 0};

        if (vips_linear(lab, &adjusted, a, b, 3, nullptr)) {
            g_object_unref(lab);
            set_error(vips_error_buffer());
            vips_error_clear();
            goto cleanup;
        }
        g_object_unref(lab);

        if (vips_colourspace(adjusted, &next, VIPS_INTERPRETATION_sRGB, nullptr)) {
            g_object_unref(adjusted);
            set_error(vips_error_buffer());
            vips_error_clear();
            goto cleanup;
        }
        g_object_unref(adjusted);
        g_object_unref(current);
        current = next;
        next = nullptr;
    }

    // 应用色温
    if (std::abs(adj->temperature) > 0.01f) {
        double shift = adj->temperature / 100.0;
        double r_mult = 1.0 + shift * 0.15;
        double b_mult = 1.0 - shift * 0.15;
        double a[] = {r_mult, 1.0, b_mult};
        double b[] = {0, 0, 0};

        if (vips_linear(current, &next, a, b, 3, nullptr)) {
            set_error(vips_error_buffer());
            vips_error_clear();
            goto cleanup;
        }
        g_object_unref(current);
        current = next;
        next = nullptr;
    }

    // 应用模糊
    if (adj->blur > 0.01f) {
        float sigma = adj->blur / 10.0f;
        if (vips_gaussblur(current, &next, sigma, nullptr)) {
            set_error(vips_error_buffer());
            vips_error_clear();
            goto cleanup;
        }
        g_object_unref(current);
        current = next;
        next = nullptr;
    }

    // 应用锐化
    if (adj->sharpen > 0.01f) {
        float amount = adj->sharpen / 50.0f;
        if (vips_sharpen(current, &next, "sigma", 1.0, "y2", amount, "y3", amount * 2, nullptr)) {
            set_error(vips_error_buffer());
            vips_error_clear();
            goto cleanup;
        }
        g_object_unref(current);
        current = next;
        next = nullptr;
    }

    // 保存结果
    {
        const char* ext = strrchr(output_path, '.');
        if (ext && (strcmp(ext, ".jpg") == 0 || strcmp(ext, ".jpeg") == 0)) {
            if (vips_jpegsave(current, output_path, "Q", quality, nullptr)) {
                set_error(vips_error_buffer());
                vips_error_clear();
                goto cleanup;
            }
        } else {
            if (vips_image_write_to_file(current, output_path, nullptr)) {
                set_error(vips_error_buffer());
                vips_error_clear();
                goto cleanup;
            }
        }
    }

    result = 0;

cleanup:
    if (next) g_object_unref(next);
    if (current) g_object_unref(current);
    return result;
}
