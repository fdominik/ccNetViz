float isAnimateCovered() {
  vec2 pos = gl_FragCoord.xy;
  vec2 viewport = 2. * v_screen;
  float maxLen = length(viewport);
  vec2 startPos = viewport * v_startPos;
  vec2 endPos = viewport * v_endPos;
  float totalLen = distance(startPos, endPos);
  float len = distance(pos, startPos);
  // float r = 300.;
  float r =
      ease(fract(v_time * animateSpeed * 0.2 * maxLen / totalLen)) * totalLen;
  // float r = 0.5 * totalLen;
  float draw = 1. - step(r, len);
  return draw;
}

float isAnimateCoveredGradient() {
  vec2 pos = gl_FragCoord.xy;
  vec2 viewport = 2. * v_screen;
  float maxLen = length(viewport);
  vec2 startPos = viewport * v_startPos;
  vec2 endPos = viewport * v_endPos;
  float totalLen = distance(startPos, endPos);
  float len = distance(pos, startPos);
  float gradLen = 180.; // TODO: can config
  float r = ease(fract(v_time * animateSpeed * 0.2 * maxLen / totalLen)) *
            (totalLen + gradLen / 2.); // NOTE: use 0.2 as a proper factor
  // float r = 0.5 * totalLen;
  float draw = fract(smoothstep(r - gradLen, r, len));
  return draw;
}

float isAnimateCoveredDoubleGradient() {
  vec2 pos = gl_FragCoord.xy;
  vec2 viewport = 2. * v_screen;
  float maxLen = length(viewport);
  vec2 startPos = viewport * v_startPos;
  vec2 endPos = viewport * v_endPos;
  float totalLen = distance(startPos, endPos);
  float len = distance(pos, startPos);
  float gradLen = 90.; // TODO: can config
  float r = ease(fract(v_time * animateSpeed * 0.2 * maxLen / totalLen)) *
            (totalLen + gradLen / 2.); // NOTE: use 0.2 as a proper factor

  float draw = (1. - step(r, len)) * fract(smoothstep(r - gradLen, r, len)) +
               (1. - step(r + gradLen, len)) * step(r, len) *
                   (1. - fract(smoothstep(r, r + gradLen, len)));
  return draw;
}

float isAnimateBubble() {
  vec2 pos = gl_FragCoord.xy;
  vec2 viewport = 2. * v_screen;
  float maxLen = length(viewport);

  vec2 startPos = viewport * v_startPos;
  vec2 endPos = viewport * v_endPos;

  vec2 vec = endPos - startPos;
  vec2 norm = normalize(vec2(-vec.y, vec.x));
  // vec2 norm = normalize(n);
  mat2 rotateMat = mat2(norm.y, norm.x, -norm.x, norm.y); // rotate to horizental

  startPos += norm * 5.; // TODO: magic number?? don't know why I need to add this offset
  endPos += norm * 5.;

  float totalLen = distance(startPos, endPos);
  float r = ease(fract(v_time * animateSpeed * 0.2 * maxLen / totalLen)) * totalLen;
  // float r = 0.5 * totalLen;

  float currWidth = length(dot(pos - startPos, norm));

  vec2 center = startPos + normalize(vec) * r;

  vec2 newPos = center + (rotateMat * (pos - center));

  // if (currWidth > v_lineWidth && length(pos - center) > v_animateMaxWidth) {
    // return 0.;
  // }
  if (currWidth > v_lineWidth && length(newPos.x - center.x) > v_animateMaxWidth) {
    return 0.;
  }

  return 1.;

  // float draw = 1. - step(r, len);
  // return draw;
}