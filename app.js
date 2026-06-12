// ==========================================
// 設定値
// ==========================================
const LIFF_ID = '2010370033-N6k69U5l'; 
const GAS_WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbzACsGXbFTNU578DUOR-_vPz1jr4lO_i5ArVdQ0SPkheBG2KKt4NFJx2FttUYwfkRXsWw/exec'; 

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
      
      // ★ 変更点：userIdではなく、GASで検証するための idToken を取得する
      const idToken = liff.getIDToken();
      
      if (idToken) {
        // トークンが取得できたら自動でAnyCrossデータを取得しにいく
        fetchAnyCrossData(idToken);
      } else {
        throw new Error("IDトークンが取得できませんでした");
      }
      
    } else {
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
 * @param {string} idToken - 取得したLINE IDトークン
 */
async function fetchAnyCrossData(idToken) {
  statusMessage.textContent = 'AnyCrossデータ取得中...';

  try {
    // ★ 変更点：GASの doGet() に合わせるため、URLパラメータにセットしてGETリクエストを送る
    const url = new URL(GAS_WEBAPP_URL);
    url.searchParams.append('action', 'fetch');
    url.searchParams.append('idToken', idToken);

    const response = await fetch(url.toString(), {
      method: 'GET'
    });

    const result = await response.json();

    if (result.success) {
      statusMessage.textContent = 'データ取得成功！';
      // 取得したシフト情報を表示
      resultBox.textContent = JSON.stringify(result.shifts, null, 2);
    } else {
      statusMessage.textContent = 'データ取得エラー';
      resultBox.textContent = `${result.message}\n${result.anycrossRaw || ''}`;
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
document.addEventListener('DOMContentLoaded', initializeApp);