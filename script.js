const symbols = ['diamond', 'apple', 'banana', 'cherry', 'grape', 'orange'];
let score = parseInt(localStorage.getItem('slotScore')) || 0;
let checkInDays = parseInt(localStorage.getItem('checkInDays')) || 0;
let streak = parseInt(localStorage.getItem('streakDays')) || 0;

// 机器状态：0 = 等待打卡, 1 = 待抽奖, 2 = 抽奖运行中
let appState = 0; 

// 初始化界面
initReels();
updateUI();

const mainBtn = document.getElementById('mainBtn');
const penaltyBtn = document.getElementById('penaltyBtn');

// 核心按钮点击逻辑
mainBtn.addEventListener('click', () => {
    if (appState === 0) {
        // --- 步骤1：执行打卡 ---
        checkInDays++;
        streak++;
        
        let toastMsg = "已打卡 积分+1！";
        score += 1; // 打卡基础分

        // 连胜判断
        if (streak % 5 === 0) {
            score += 2; // 额外+2分（加上基础共+3分）
            toastMsg = `连续五天打卡 积分+3\n🔥 坚持就是胜利！`;
        }
        
        showToast(toastMsg);
        updateUI();

        // 切换按钮状态到“抽奖”
        appState = 1;
        mainBtn.className = "btn-spin";
        mainBtn.innerText = "已打卡，点击抽奖 🎰";
        
    } else if (appState === 1) {
        // --- 步骤2：执行抽奖 ---
        startSpin();
    }
});

// 中断打卡逻辑
penaltyBtn.addEventListener('click', () => {
    if (appState === 2) return; // 摇奖时禁用
    streak = 0; // 连胜清零
    score = Math.max(0, score - 3);
    updateUI();
    showToast("💔 中断打卡 积分-3\n亡羊补牢，为时不晚！");
});

function updateUI() {
    document.getElementById('scoreDisplay').innerText = score;
    document.getElementById('daysDisplay').innerText = checkInDays;
    document.getElementById('streakDisplay').innerText = streak;
    
    let progress = Math.min((score / 120) * 100, 100);
    document.getElementById('progressFill').style.width = progress + '%';
    
    // 持久化
    localStorage.setItem('slotScore', score);
    localStorage.setItem('checkInDays', checkInDays);
    localStorage.setItem('streakDays', streak);
}

// 弹出消息函数
function showToast(message) {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerText = message;
    container.appendChild(toast);
    // 4秒后清理 DOM
    setTimeout(() => { toast.remove(); }, 4000);
}

function getRandomSymbol() { return symbols[Math.floor(Math.random() * symbols.length)]; }

// 初始化：给三个滚筒塞入一张随机图，避免开局空白
function initReels() {
    for(let i=1; i<=3; i++) {
        document.getElementById(`strip${i}`).innerHTML = `<img src="assets/images/${getRandomSymbol()}.png">`;
    }
}

// 真实滚动核心逻辑
function startSpin() {
    appState = 2; // 锁定状态
    mainBtn.disabled = true;
    penaltyBtn.disabled = true;
    
    const audioSpin = document.getElementById('audioSpin');
    const audioStop = document.getElementById('audioStop');
    audioSpin.currentTime = 0;
    audioSpin.play().catch(e=>{});

    // 提前决定这把的结果
    const results = [getRandomSymbol(), getRandomSymbol(), getRandomSymbol()];
    const strips = [document.getElementById('strip1'), document.getElementById('strip2'), document.getElementById('strip3')];
    
    // 配置滚动参数：生成的图片数量越多，转得越久。我们生成 40 张。
    const itemsPerReel = 40; 
    const itemHeight = 80; // 必须和 CSS 里的高度严格一致

    strips.forEach((strip, i) => {
        // 1. 清除上一次的动画状态，瞬间回到顶部
        strip.style.transition = 'none';
        strip.style.transform = 'translateY(0)';

        // 2. 动态生成布条内容：前39张随机，最后1张是命中结果
        let htmlContent = '';
        for(let j = 0; j < itemsPerReel - 1; j++) {
            htmlContent += `<img src="assets/images/${getRandomSymbol()}.png">`;
        }
        htmlContent += `<img src="assets/images/${results[i]}.png">`;
        strip.innerHTML = htmlContent;

        // 3. 强制浏览器重绘 (Reflow)，让瞬间回顶生效
        strip.offsetHeight; 

        // 4. 添加动画！分别设置 3秒、4秒、5秒 的过渡时间。
        // cubic-bezier(0.1, 0.7, 0.1, 1) 是一条完美的“先快后极慢”的减速曲线
        const spinTime = 3 + i * 1; 
        strip.style.transition = `transform ${spinTime}s cubic-bezier(0.1, 0.7, 0.1, 1)`;
        
        // 将布条向上拉动 (总高度 - 1个图片高度)
        strip.style.transform = `translateY(-${(itemsPerReel - 1) * itemHeight}px)`;

        // 给每个轮盘绑定停止时的“咔哒”音效
        setTimeout(() => {
            audioStop.currentTime = 0;
            audioStop.play().catch(e=>{});
        }, spinTime * 1000);
    });

    // 等待最慢的那个轮盘（5秒）停下后，进行结算
    setTimeout(() => {
        audioSpin.pause();
        calculateResult(results);
        
        // 恢复初始状态
        mainBtn.disabled = false;
        penaltyBtn.disabled = false;
        mainBtn.className = "btn-checkin";
        mainBtn.innerText = "点击打卡";
        appState = 0;
    }, 5000); 
}

// 结算与提示
function calculateResult(res) {
    const diamondCount = res.filter(s => s === 'diamond').length;
    const isAllSameFruit = res[0] === res[1] && res[1] === res[2] && res[0] !== 'diamond';
    
    // 随机掉落 1-3 分 (摇奖特有积分，区别于打卡的固定1分)
    const rand = Math.random() * 100;
    let basePoints = rand < 50 ? 1 : (rand < 85 ? 2 : 3);
    
    let msg = `🎲 摇奖掉落 ${basePoints} 积分！\n`;
    let won = false; let isBigWin = false;

    if (diamondCount === 3) {
        msg += "💎 特等奖！狂飙 30 积分！";
        score += 30; won = true; isBigWin = true;
    } else if (isAllSameFruit) {
        msg += "🎁 一等奖！赢取：一天游戏/短途旅行！";
        won = true;
    } else if (diamondCount === 2) {
        msg += "🎬 二等奖！赢取：涂装/电影！";
        won = true;
    } else if (diamondCount === 1) {
        msg += "📺 三等奖！赢取：看一集剧！";
        won = true;
    } else {
        msg += "💨 未中奖，大奖正在路上！";
    }

    score += basePoints;
    updateUI();
    showToast(msg); // 用绚丽的 Toast 代替以前的呆板文字

    if (won) {
        let audio = document.getElementById(isBigWin ? 'audioWinBig' : 'audioWinSmall');
        audio.currentTime = 0;
        audio.play().catch(e=>{});
    }
}