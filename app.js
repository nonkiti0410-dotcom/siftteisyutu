// ==========================================
// 設定値（自身の環境に合わせて書き換えてください）
// ==========================================
const LIFF_ID = '2010370033-N6k69U5l'; // LINE Developersで発行したLIFF ID
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzACsGXbFTNU578DUOR-_vPz1jr4lO_i5ArVdQ0SPkheBG2KKt4NFJx2FttUYwfkRXsWw/exec'; // GASで発行したウェブアプリURL

// DOM要素の取得
const statusMessage = document.getElementById('status-message');
const resultBox = document.getElementById('result-box');

/**
 * 1. LIFFの初期化処理
 */
async function initializeApp() {
  try {
    await liff.init({ liffId: LIFF_ID });
    
    if (liff.isLoggedIn()) {
      statusMessage.textContent = 'LINE情報取得中...';
      const profile = await liff.getProfile();
      fetchAnyCrossData(profile.userId);
    } else {
      // 未ログイン状態ならログイン画面へリダイレクト
      liff.login();
    }
  } catch (error) {
    statusMessage.textContent = 'LIFF初期化エラー';
    resultBox.textContent = error.toString();
    console.error('LIFF Initialization Error:', error);
  }
}

/**
 * 2. GAS経由でAnyCrossのデータを取得する処理
 * @param {string} userId - 取得したLINEユーザーID
 */
async function fetchAnyCrossData(userId) {
  statusMessage.textContent = 'AnyCrossデータ取得中...';

  try {
    const response = await fetch(GAS_WEBAPP_URL, {
      method: 'POST',
      // GASのCORSエラー回避のため text/plain を指定
      headers: {
        'Content-Type': 'text/plain', 
      },
      body: JSON.stringify({ userId: userId })
    });

    const result = await response.json();

    if (result.status === 'success') {
      statusMessage.textContent = 'データ取得成功！';
      resultBox.textContent = JSON.stringify(result.data, null, 2);
    } else {
      statusMessage.textContent = 'データ取得エラー';
      resultBox.textContent = `${result.message}\n${JSON.stringify(result.details || '')}`;
      console.error('API Response Error:', result);
    }

  } catch (error) {
    statusMessage.textContent = '通信エラー';
    resultBox.textContent = error.toString();
    console.error('Fetch Error:', error);
  }
}

// ==========================================
// イベントリスナーの登録
// ==========================================
// HTMLの読み込みが完了したら initializeApp を実行する
document.addEventListener('DOMContentLoaded', initializeApp);