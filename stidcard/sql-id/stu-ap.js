function setNameFontSize(selector, maxChars) {
  document.querySelectorAll(selector).forEach(box => {
    const nameDiv = box.querySelector('.name-box');
    if (!nameDiv) return;
    const fontSize = box.offsetHeight / maxChars * 0.98;
    nameDiv.style.fontSize = fontSize + "px";
  });
}

function fitAllNameBoxes() {
  setNameFontSize('.bigname-box', 12);
  setNameFontSize('.littlename-box', 9);
}

function setInfoBoxFontSize() {
  const infoBoxes = document.querySelectorAll('.info-box');
  if (!infoBoxes.length) return;
  let minHeight = Infinity;
  infoBoxes.forEach(box => {
    const h = box.offsetHeight;
    if (h < minHeight) minHeight = h;
  });
  const fontSize = minHeight * 0.62;
  infoBoxes.forEach(box => {
    box.style.fontSize = fontSize + "px";
  });
}

function setFlipBtnFontSize() {
  document.querySelectorAll('.row-flip-btn').forEach(box => {
    const btn = box.querySelector('.flip-btn');
    if (!btn) return;
    // 用高度算，讓四字不會超出（0.55可微調）
    const fontSize = Math.max(box.offsetHeight * 0.6);
    btn.style.fontSize = fontSize + "px";
  });
}

function setStudentIdFontSize() {
  document.querySelectorAll('.student-id').forEach(box => {
    // 用外層高度計算，數字可依區塊比例微調
    const fontSize = Math.max(box.offsetHeight * 0.7); // 12是最小字體
    box.style.fontSize = fontSize + "px";
  });
}

function fitAll() {
  fitAllNameBoxes();
  setInfoBoxFontSize();
  setFlipBtnFontSize();
  setStudentIdFontSize();
}

window.addEventListener('DOMContentLoaded', fitAll);
window.addEventListener('resize', fitAll);
window.addEventListener('load', fitAll);

// 更多
// 判斷 info-value 超過 13 字才顯示 ...MORE
function checkLongTextByCharCount(N = 13) {
  document.querySelectorAll('.info-box').forEach(box => {
    const value = box.querySelector('.info-value');
    const btn = box.querySelector('.show-more-btn');
    if (!value || !btn) return;
    if (value.innerText.trim().length > N) {
      btn.style.display = 'block';
      btn.onclick = function() {
        // 標題優先抓 info-label, 沒有就用 data-title (button自訂)，最後才 "內容"
        const label = this.dataset.title || box.querySelector('.info-label')?.innerText || "效果";
        showInfoModal(label, value.innerHTML);
      }
    } else {
      btn.style.display = 'none';
    }
  });
}
// 初次和視窗大小變動時都要判斷一次
window.addEventListener('DOMContentLoaded', () => checkLongTextByCharCount(13));
window.addEventListener('resize', () => checkLongTextByCharCount(13));

// 彈跳視窗相關
function showInfoModal(title, content) {
  document.getElementById('info-modal-title').innerText = title;
  document.getElementById('info-modal-body').innerHTML = content;
  document.getElementById('info-modal').style.display = 'flex';
}
// 點背景關閉彈窗
document.getElementById('info-modal').addEventListener('click', function(e) {
  if (e.target === this) {
    e.stopPropagation();  // ★★★ 關鍵！阻止觸發 document click
    this.style.display = 'none';
  }
});
