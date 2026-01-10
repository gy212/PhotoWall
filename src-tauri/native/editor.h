/**
 * PhotoWall Native Editor
 *
 * 使用 libvips 实现专业级图像处理
 */

#ifndef PHOTOWALL_EDITOR_H
#define PHOTOWALL_EDITOR_H

#include <stdint.h>

#ifdef _WIN32
    #ifdef PW_EDITOR_EXPORTS
        #define PW_API __declspec(dllexport)
    #else
        #define PW_API __declspec(dllimport)
    #endif
#else
    #define PW_API
#endif

#ifdef __cplusplus
extern "C" {
#endif

/**
 * 初始化编辑器（必须在使用前调用）
 * @return 0 成功，非0 失败
 */
PW_API int pw_editor_init(void);

/**
 * 清理编辑器资源
 */
PW_API void pw_editor_cleanup(void);

/**
 * 图像调整参数
 */
typedef struct {
    float brightness;    // -100 to 100
    float contrast;      // -100 to 100
    float saturation;    // -100 to 100
    float exposure;      // -200 to 200 (EV * 100)
    float highlights;    // -100 to 100
    float shadows;       // -100 to 100
    float temperature;   // -100 to 100
    float tint;          // -100 to 100
    float sharpen;       // 0 to 100
    float blur;          // 0 to 100
    float vignette;      // 0 to 100
} PwAdjustments;

/**
 * 应用图像调整
 * @param input_path 输入图像路径
 * @param output_path 输出图像路径
 * @param adjustments 调整参数
 * @param quality JPEG 质量 (1-100)
 * @return 0 成功，非0 失败
 */
PW_API int pw_apply_adjustments(
    const char* input_path,
    const char* output_path,
    const PwAdjustments* adjustments,
    int quality
);

/**
 * 应用模糊
 * @param input_path 输入图像路径
 * @param output_path 输出图像路径
 * @param sigma 模糊半径
 * @return 0 成功，非0 失败
 */
PW_API int pw_blur(const char* input_path, const char* output_path, float sigma);

/**
 * 应用锐化
 * @param input_path 输入图像路径
 * @param output_path 输出图像路径
 * @param sigma 锐化半径
 * @param amount 锐化强度
 * @return 0 成功，非0 失败
 */
PW_API int pw_sharpen(const char* input_path, const char* output_path, float sigma, float amount);

/**
 * 调整曝光（带高光保护）
 * @param input_path 输入图像路径
 * @param output_path 输出图像路径
 * @param ev 曝光值 (-2.0 to 2.0)
 * @return 0 成功，非0 失败
 */
PW_API int pw_adjust_exposure(const char* input_path, const char* output_path, float ev);

/**
 * 调整高光
 * @param input_path 输入图像路径
 * @param output_path 输出图像路径
 * @param amount 调整量 (-100 to 100)
 * @return 0 成功，非0 失败
 */
PW_API int pw_adjust_highlights(const char* input_path, const char* output_path, float amount);

/**
 * 调整阴影
 * @param input_path 输入图像路径
 * @param output_path 输出图像路径
 * @param amount 调整量 (-100 to 100)
 * @return 0 成功，非0 失败
 */
PW_API int pw_adjust_shadows(const char* input_path, const char* output_path, float amount);

/**
 * 调整色温
 * @param input_path 输入图像路径
 * @param output_path 输出图像路径
 * @param kelvin_shift 色温偏移 (-100 冷 to 100 暖)
 * @return 0 成功，非0 失败
 */
PW_API int pw_adjust_temperature(const char* input_path, const char* output_path, float kelvin_shift);

/**
 * 获取最后一次错误信息
 * @return 错误信息字符串
 */
PW_API const char* pw_get_last_error(void);

#ifdef __cplusplus
}
#endif

#endif // PHOTOWALL_EDITOR_H
