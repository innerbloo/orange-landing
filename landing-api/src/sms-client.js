/**
 * NHN Cloud SMS 발송 클라이언트
 */

const NHN_SMS_API = 'https://api-sms.cloud.toast.com/sms/v3.0/appKeys';

/**
 * SMS 인증번호 발송
 * @param {object} env - Worker 환경변수
 * @param {string} phone - 수신번호 (010-1234-5678 또는 01012345678)
 * @param {string} code - 인증번호 (6자리)
 */
export async function sendSmsCode(env, phone, code) {
  const appKey = env.NHN_APP_KEY;
  const secretKey = env.NHN_SECRET_KEY;
  const sendNo = env.NHN_SENDER_NUMBER;

  // 하이픈 제거
  const recipientNo = phone.replace(/-/g, '');

  const url = `${NHN_SMS_API}/${appKey}/sender/sms`;

  const body = {
    body: `인증번호 [${code}]를 입력해주세요.`,
    sendNo,
    recipientList: [{ recipientNo }],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      'X-Secret-Key': secretKey,
    },
    body: JSON.stringify(body),
  });

  const result = await res.json();

  if (!result.header || !result.header.isSuccessful) {
    const msg = result.header?.resultMessage || 'SMS 발송 실패';
    throw new Error(msg);
  }

  return result;
}
