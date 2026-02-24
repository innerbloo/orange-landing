/**
 * 버즈빌 API 클라이언트
 * API 명세서 수령 후 활성화 예정
 */

/**
 * 버즈빌 API 호출
 * @param {object} env - Worker 환경변수
 * @param {object} data - 폼 데이터
 * @returns {object} API 응답
 */
export async function callBuzzvilApi(env, data) {
  const payload = {
    user_id: data.phone,
    mission_type: 'form_submit',
  };

  const response = await fetch(env.BUZZVIL_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.BUZZVIL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`버즈빌 API 오류: ${response.status} ${error}`);
  }

  return await response.json();
}
