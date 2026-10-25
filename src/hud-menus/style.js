export const CSS = `
#ui{position:fixed;inset:0;pointer-events:none;font-family:"Oswald","Arial Narrow",Arial,sans-serif;color:#eee;user-select:none;z-index:5}
#ui .hidden{display:none!important}
#hud{position:absolute;top:18px;left:50%;transform:translateX(-50%);width:min(980px,94vw);display:grid;grid-template-columns:1fr auto 1fr;gap:14px;align-items:start;transition:opacity .4s}
.plate{display:flex;flex-direction:column;gap:4px}
.plate.right{align-items:flex-end}
.plate .name{font-size:15px;letter-spacing:2px;text-transform:uppercase;font-weight:700;text-shadow:0 1px 3px #000;display:flex;gap:8px;align-items:center}
.plate .corner{width:10px;height:10px;display:inline-block}
.bar{width:100%;height:9px;background:rgba(0,0,0,.55);border:1px solid rgba(255,255,255,.18);position:relative;overflow:hidden}
.bar.stam{height:4px;border:none;background:rgba(0,0,0,.5)}
.bar .fill{position:absolute;top:0;bottom:0;left:0;background:linear-gradient(#f2f2f2,#bdbdbd);transition:width .12s}
.bar .cap{position:absolute;top:0;bottom:0;left:0;background:rgba(160,30,30,.45)}
.bar.stam .fill{background:#e3b341}
.plate.right .bar .fill,.plate.right .bar .cap{left:auto;right:0}
#clock{background:rgba(8,8,8,.78);border:1px solid rgba(255,255,255,.15);padding:4px 14px;text-align:center;min-width:92px}
#clock .rnd{font-size:11px;letter-spacing:3px;color:#c9c9c9}
#clock .time{font-size:24px;font-weight:700;letter-spacing:1px;font-variant-numeric:tabular-nums}
#msg{position:absolute;top:38%;left:0;right:0;text-align:center;font-size:clamp(40px,8vw,96px);font-weight:800;letter-spacing:10px;text-shadow:0 4px 30px rgba(0,0,0,.9);opacity:0;transition:opacity .25s,transform .25s;transform:scale(1.1)}
#msg.show{opacity:1;transform:scale(1)}
#msg .sub{display:block;font-size:18px;letter-spacing:6px;font-weight:400;color:#ccc;margin-top:6px}
#count{position:absolute;top:22%;left:0;right:0;text-align:center;font-size:120px;font-weight:800;color:#fff;text-shadow:0 0 40px rgba(0,0,0,.9)}
.panel{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:auto;background:radial-gradient(ellipse at center,rgba(0,0,0,.35),rgba(0,0,0,.85))}
.box{background:rgba(10,10,10,.82);border:1px solid rgba(255,255,255,.12);padding:28px 36px;min-width:min(520px,90vw);max-width:92vw;max-height:90vh;overflow:auto;box-shadow:0 20px 80px rgba(0,0,0,.6)}
.box h1{margin:0;font-size:clamp(48px,9vw,86px);letter-spacing:12px;line-height:1;color:#f1f1f1}
.box h1 span{color:#b3191f}
.box h2{margin:0 0 14px;letter-spacing:6px;font-size:28px}
.box .tag{letter-spacing:5px;color:#9a9a9a;font-size:13px;margin:6px 0 22px;text-transform:uppercase}
.btn{display:block;width:100%;margin:8px 0;padding:11px 16px;background:#161616;color:#eee;border:1px solid #3a3a3a;font:inherit;font-size:17px;letter-spacing:4px;text-transform:uppercase;cursor:pointer;text-align:left}
.btn:hover,.btn:focus{background:#b3191f;border-color:#d62a31;outline:none}
table.ctl{width:100%;border-collapse:collapse;margin-top:16px;font-family:Arial,sans-serif;font-size:13px}
table.ctl td{padding:4px 6px;border-bottom:1px solid rgba(255,255,255,.07)}
table.ctl td:first-child{color:#aaa}
table.ctl td:last-child{text-align:right;color:#fff}
.row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:10px 0;font-family:Arial,sans-serif;font-size:14px}
.row select,.row input{background:#1b1b1b;color:#eee;border:1px solid #444;padding:4px}
.cards{font-family:Arial,sans-serif;font-size:14px;margin:12px 0;color:#ccc}
#hint{position:absolute;bottom:12px;left:0;right:0;text-align:center;font-family:Arial,sans-serif;font-size:12px;color:rgba(255,255,255,.45)}
`;
