const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] as string)
}

export function threeDsPage(intentId: string, returnUrl: string, publishableKey: string): string {
  const intent = JSON.stringify(intentId)
  const back = JSON.stringify(returnUrl)
  const key = JSON.stringify(publishableKey)
  return `<!DOCTYPE html>
<html><head><title>3DS 验证（模拟）</title>
<style>
  body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; background: #f6f8fa; }
  .card { background: #fff; padding: 40px; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,.1); text-align: center; max-width: 400px; }
  button { margin: 8px; padding: 12px 24px; border-radius: 8px; border: none; font-size: 15px; cursor: pointer; }
  .approve { background: #635bff; color: #fff; }
  .decline { background: #eee; color: #333; }
</style></head>
<body><div class="card">
  <h2>3D Secure 验证（模拟）</h2>
  <p>银行要求额外身份验证<br/>Intent: ${escapeHtml(intentId)}</p>
  <button class="approve" onclick="complete('approved')">验证通过</button>
  <button class="decline" onclick="complete('failed')">验证失败</button>
</div>
<script>
  function complete(status) {
    var intentId = ${intent};
    var returnUrl = ${back};
    fetch('/v1/3ds/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Key': ${key} },
      body: JSON.stringify({ intent: intentId, status: status })
    }).then(function() {
      var sep = returnUrl.indexOf('?') >= 0 ? '&' : '?';
      window.location.href = returnUrl + sep + 'status=' + status + '&intent=' + encodeURIComponent(intentId);
    });
  }
</script>
</body></html>`
}

export function checkoutPage(publishableKey: string): string {
  const key = JSON.stringify(publishableKey)
  return `<!DOCTYPE html>
<html lang="zh-CN"><head><meta charset="utf-8"/><title>Nexus Checkout</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, 'Segoe UI', sans-serif; margin: 0; background: #f6f8fa; color: #1f2937; }
  .checkout { max-width: 420px; margin: 0 auto; padding: 24px 16px; }
  .summary { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 16px; }
  .summary h2 { margin: 0 0 12px; font-size: 15px; color: #6b7280; font-weight: 600; }
  .line-item { display: flex; justify-content: space-between; font-size: 14px; padding: 4px 0; }
  .total { display: flex; justify-content: space-between; border-top: 1px solid #e5e7eb; margin-top: 8px; padding-top: 10px; font-weight: 700; font-size: 16px; }
  form { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
  label { display: block; font-size: 13px; color: #4b5563; margin: 10px 0 4px; }
  input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 15px; }
  input:focus { outline: none; border-color: #635bff; box-shadow: 0 0 0 3px rgba(99,91,255,.15); }
  .row { display: flex; gap: 10px; }
  .row > div { flex: 1; }
  button { width: 100%; margin-top: 16px; padding: 12px; border: none; border-radius: 8px; background: #635bff; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: .5; cursor: not-allowed; }
  .error { color: #dc2626; font-size: 13px; margin-top: 10px; min-height: 18px; }
  .success { background: #fff; border: 1px solid #a7f3d0; border-radius: 10px; padding: 32px 16px; text-align: center; display: none; }
  .success .mark { width: 48px; height: 48px; border-radius: 50%; background: #059669; color: #fff; font-size: 26px; line-height: 48px; margin: 0 auto 12px; }
</style></head>
<body>
<div class="checkout">
  <div class="summary">
    <h2 id="cs-name">订单</h2>
    <div id="cs-items"></div>
    <div class="total"><span>合计</span><span id="cs-total">--</span></div>
  </div>
  <form id="cs-form">
    <label>卡号</label>
    <input id="cs-number" class="checkout-number" autocomplete="cc-number" placeholder="1234 1234 1234 1234" required />
    <div class="row">
      <div><label>有效期 (MM/YY)</label><input id="cs-expiry" class="checkout-expiry" autocomplete="cc-exp" placeholder="MM/YY" required /></div>
      <div><label>CVC</label><input id="cs-cvc" class="checkout-cvc" autocomplete="cc-csc" placeholder="CVC" required /></div>
    </div>
    <button id="cs-pay" type="submit">支付</button>
    <p class="error" id="cs-error" role="alert"></p>
  </form>
  <div class="success" id="cs-success">
    <div class="mark">✓</div>
    <h2>支付成功</h2>
    <p id="cs-success-detail"></p>
  </div>
</div>
<script>
(function () {
  var publishableKey = ${key};
  var params = new URLSearchParams(location.search);
  var clientSecret = params.get('clientSecret') || '';
  var sessionId = clientSecret.split('_secret')[0];
  var session = null;
  function headers(extra) {
    return Object.assign({ 'Content-Type': 'application/json', 'X-Nexus-Key': publishableKey, 'X-Nexus-Client-Secret': clientSecret }, extra || {});
  }
  function fmt(amount, currency) {
    var symbol = currency === 'cny' ? '¥' : currency === 'usd' ? '$' : currency === 'eur' ? '€' : currency.toUpperCase() + ' ';
    return symbol + (amount / 100).toFixed(2);
  }
  fetch('/v1/checkout/sessions/' + sessionId, { headers: { 'X-Nexus-Key': publishableKey, 'X-Nexus-Client-Secret': clientSecret } })
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.checkout_session) {
        document.getElementById('cs-error').textContent = (data.error && data.error.message) || '会话加载失败';
        document.getElementById('cs-pay').disabled = true;
        return;
      }
      session = data.checkout_session;
      var items = document.getElementById('cs-items');
      (session.line_items || []).forEach(function (item) {
        var row = document.createElement('div');
        row.className = 'line-item';
        row.innerHTML = '<span></span><span></span>';
        var unit = item.amount != null ? item.amount : (item.unit_amount || 0);
        row.children[0].textContent = item.name + ' × ' + (item.quantity || 1);
        row.children[1].textContent = fmt(unit * (item.quantity || 1), session.currency);
        items.appendChild(row);
      });
      document.getElementById('cs-total').textContent = fmt(session.amount, session.currency);
    });
  document.getElementById('cs-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!session) return;
    var errorEl = document.getElementById('cs-error');
    errorEl.textContent = '';
    var payBtn = document.getElementById('cs-pay');
    payBtn.disabled = true;
    payBtn.textContent = '处理中...';
    var number = document.getElementById('cs-number').value.replace(/\\D/g, '');
    var expiry = document.getElementById('cs-expiry').value.replace(/\\D/g, '');
    var cvc = document.getElementById('cs-cvc').value.trim();
    var expMonth = parseInt(expiry.slice(0, 2), 10);
    var expYear = 2000 + parseInt(expiry.slice(2, 4), 10);
    fetch('/v1/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Nexus-Key': publishableKey },
      body: JSON.stringify({ card: { number: number, exp_month: expMonth, exp_year: expYear, cvc: cvc } })
    })
      .then(function (r) { return r.json(); })
      .then(function (tokenData) {
        if (tokenData.error) throw new Error(tokenData.error.message);
        return fetch('/v1/checkout/sessions/' + session.id + '/confirm', {
          method: 'POST',
          headers: headers(),
          body: JSON.stringify({ payment_method_token: tokenData.token })
        });
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.error) throw new Error(data.error.message);
        session = data.checkout_session;
        document.getElementById('cs-form').style.display = 'none';
        var successEl = document.getElementById('cs-success');
        successEl.style.display = 'block';
        document.getElementById('cs-success-detail').textContent = session.id + ' · ' + fmt(session.amount, session.currency);
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'nexus:checkout-complete', session: { id: session.id, status: session.status, payment_intent: session.payment_intent } }, location.origin);
        }
        if (session.ui_mode === 'redirect' && session.success_url) {
          var dest = session.success_url.replace('{SESSION_ID}', session.id);
          if (window.parent !== window) {
            window.parent.postMessage({ type: 'nexus:checkout-redirect', url: dest }, location.origin);
          } else {
            window.location.href = dest;
          }
        }
      })
      .catch(function (err) {
        errorEl.textContent = err.message || '支付失败，请重试。';
        payBtn.disabled = false;
        payBtn.textContent = '支付';
      });
  });
})();
</script>
</body></html>`
}

export function isCheckoutPath(url: string): boolean {
  return url === '/__nexus-checkout' || url === '/__nexus-checkout/' || url === '/__nexus-checkout/index.html'
}
