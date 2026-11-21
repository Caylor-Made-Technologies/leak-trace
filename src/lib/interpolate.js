/** Piecewise-linear map, clamped (what useTransform does with ranges). */
export function interpolate(input, output, v) {
  if (v <= input[0]) return output[0]
  for (let i = 1; i < input.length; i++) {
    if (v <= input[i]) { const k = (v - input[i - 1]) / (input[i] - input[i - 1]); return output[i - 1] + k * (output[i] - output[i - 1]) }
  }
  return output[output.length - 1]
}
