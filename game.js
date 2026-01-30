console.log("game.js carregado");

// ====================
// VARIÁVEIS PRINCIPAIS
// ====================
let width = 0;
let height = 0;

let hits = 0;
let powerUpsCollected = 0;
let frameCount = 0;

let gameState = "playing"; // "playing" | "cardSelect"
let currentCards = [];

// ====================
// PLAYER
// ====================
const player = {
    x: 0,
    y: 0,
    radius: 12,
    angle: 0
};

// ====================
// MOUSE / TOUCH
// ====================
const mouse = { x: 0, y: 0 };
let isTouching = false;

// ====================
// BULLETS
// ====================
const bullets = [];
let lastShot = 0;
const shotInterval = 1000;

// ====================
// SNAKE
// ====================
const snake = {
    segments: [],
    headAngle: 0,
    headRadius: 0,
    speed: 0.35,
    angleSpeed: 0.012,
    angleSpacing: 0.32,
    radiusSpacing: 8,
    pushBack: 2,
    freezeTime: 0
};

// ====================
// WAVES
// ====================
let wave = 1;
let waveInProgress = true;

// ====================
// PLAYER STATS
// ====================
const baseStats = {
    fireRate: 1,
    fireSpeed: 1,
    bulletSpeed: 3,
    penetration: 0,
    multishot: 1,
    bulletSize: 5
};

const playerStats = {
    fireRate: 1,
    fireSpeed: 1,
    bulletSpeed: 2,
    penetration: 0,
    multishot: 1,
    bulletSize: 1
};

// ====================
// CANVAS
// ====================
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
    const dpr = window.devicePixelRatio || 1;

    width = window.innerWidth;
    height = window.innerHeight;

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    /*  // atualiza snake
     snake.headRadius = Math.max(width, height) / 2 + 50;
  */
    // define ângulo aleatório da cabeça
    snake.headAngle = Math.random() * Math.PI * 2;

    // define raio inicial próximo do player (100px já é suficiente)
    snake.headRadius = (80 + Math.random() * 40) * dpr; // ajusta ao dpr
}

window.addEventListener("resize", resize);
resize();

// ====================
// INPUT
// ====================
canvas.addEventListener("mousemove", e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

canvas.addEventListener("touchstart", e => {
    e.preventDefault();
    isTouching = true;
    const t = e.touches[0];
    mouse.x = t.clientX;
    mouse.y = t.clientY;
}, { passive: false });

canvas.addEventListener("touchmove", e => {
    e.preventDefault();
    if (!isTouching) return;
    const t = e.touches[0];
    mouse.x = t.clientX;
    mouse.y = t.clientY;
}, { passive: false });

canvas.addEventListener("touchend", e => {
    e.preventDefault();
    isTouching = false;
}, { passive: false });

// ====================
// CARDS
// ====================
const cards = [
    { id: "fireRate", title: "🔥 Gatilho Rápido", desc: "Aumenta a velocidade de disparo", apply() { playerStats.fireRate *= 1.25 } },
    { id: "bulletSpeed", title: "⚡ Munição Veloz", desc: "Projéteis mais rápidos", apply() { playerStats.bulletSpeed += 1 } },
    { id: "penetration", title: "🪓 Perfuração", desc: "Balas atravessam inimigos", apply() { playerStats.penetration += 1 } },
    { id: "multishot", title: "🔱 Tiro Triplo", desc: "Dispara mais projéteis", apply() { playerStats.multishot += 1 } },
    { id: "bulletSize", title: "💥 Bala Pesada", desc: "Projéteis maiores", apply() { playerStats.bulletSize += 1 } }
    
];

// ====================
// INICIA PRIMEIRA WAVE
// ====================
startWave(1);

// ====================
// GAME LOOP
// ====================
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}
requestAnimationFrame(loop);

// ====================
// UPDATE
// ====================
function update() {
    if (gameState === "cardSelect") return;
    frameCount++;

    // player
    player.x = width / 2;
    player.y = height / 2;
    player.angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);

    // tiros automáticos
    const now = performance.now();
    const effectiveShotInterval = shotInterval / playerStats.fireRate;
    if (now - lastShot > effectiveShotInterval) {
        shoot();
        lastShot = now;
    }

    // atualiza tiros
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < 0 || b.x > width || b.y < 0 || b.y > height) bullets.splice(i, 1);
    }

    // colisão tiros x cobra
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        let hitThisFrame = false;

        for (let j = 0; j < snake.segments.length; j++) {
            const segment = snake.segments[j];
            const angle = snake.headAngle + j * snake.angleSpacing;
            const radius = snake.headRadius + j * snake.radiusSpacing;
            const segmentPos = {
                x: width / 2 + Math.cos(angle) * radius,
                y: height / 2 + Math.sin(angle) * radius,
                radius: 5
            };

            // evita acertar mesmo segmento várias vezes
            if (bullet.hitSegments?.has(j)) continue;

            if (circleCollision(bullet, segmentPos)) {
                // marca que esse tiro acertou esse segmento
                if (!bullet.hitSegments) bullet.hitSegments = new Set();
                bullet.hitSegments.add(j);

                // remove segmento
                snake.segments.splice(j, 1);

                // pushback
                snake.headRadius += snake.radiusSpacing * snake.pushBack;
                snake.freezeTime = Math.max(snake.freezeTime, 10);

                // penetração
                bullet.penetration--;

                // estatísticas
                hits++;
                if (segment.type === "power") {
                    powerUpsCollected++;
                    openCardSelection();
                }

                // remove tiro se acabou a penetração
                if (bullet.penetration < 0) {
                    bullets.splice(i, 1);
                }

                hitThisFrame = true;
                // força tiro sair da massa
                bullet.x += bullet.vx * 2;
                bullet.y += bullet.vy * 2;

                break; // só acerta 1 segmento por frame
            }
        }
    }


    /* ======================
   5️⃣ MOVIMENTO DA COBRA
    ====================== */

    // Crescimento inicial da cobra (spawn animado)
    if (!snake.targetRadius) {
        // define a distância de spawn máxima visível da wave
        snake.targetRadius = 100 + wave * 20; // ou outro valor que quiser
    }

    if (snake.headRadius < snake.targetRadius) {
        snake.headRadius += snake.speed; // cresce até targetRadius
    } else {
        // movimento normal da cobra
        if (snake.freezeTime > 0) {
            snake.freezeTime--;
        } else {
            snake.headAngle -= snake.angleSpeed;
            snake.headRadius -= snake.speed;
        }
    }

    snake.headRadius = Math.max(snake.headRadius, 0);

    // colisão cobra x player
    const headX = width / 2 + Math.cos(snake.headAngle) * snake.headRadius;
    const headY = height / 2 + Math.sin(snake.headAngle) * snake.headRadius;
    if (circleCollision({ x: headX, y: headY, radius: 6 }, { x: player.x, y: player.y, radius: player.radius })) {
        alert("Game Over");
        window.location.reload();
    }

    checkWaveProgress();
}

// ====================
// DRAW
// ====================
function draw() {
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, width, height);

    // cobra
    console.log("cobra antes do for");
    for (let i = 0; i < snake.segments.length; i++) {
        console.log("game.cobra dentro do for carregado");
        const segment = snake.segments[i];
        const angle = snake.headAngle + i * snake.angleSpacing;
        const radius = snake.headRadius + i * snake.radiusSpacing;

        const x = width / 2 + Math.cos(angle) * radius;
        const y = height / 2 + Math.sin(angle) * radius;

        ctx.fillStyle = segment.type === "power" ? "#ff44aa" : "#8844ff";
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    }

    // linha conectando segmentos
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();
    for (let i = 0; i < snake.segments.length; i++) {
        const angle = snake.headAngle + i * snake.angleSpacing;
        const radius = snake.headRadius + i * snake.radiusSpacing;
        const x = width / 2 + Math.cos(angle) * radius;
        const y = height / 2 + Math.sin(angle) * radius;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // tiros
    ctx.fillStyle = "#ffcc00";
    for (const b of bullets) {
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
        ctx.fill();
    }

    // player
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.rotate(player.angle);
    ctx.fillStyle = "#00ffcc";
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(player.radius + 15, 0);
    ctx.stroke();
    ctx.restore();

    // HUD
    drawHUD();

    if (gameState === "cardSelect") drawCards();
}

// ====================
// DRAW HUD
// ====================
function drawHUD() {
    const barHeight = 40;
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, width, barHeight);

    ctx.fillStyle = "#fff";
    ctx.font = "13px Arial";
    ctx.textBaseline = "middle";
    ctx.fillText(`Wave: ${wave}`, 600, barHeight / 2);
    ctx.fillText(`🐍 ${snake.segments.length}`, 20, barHeight / 2);
    ctx.fillText(`🎯 ${hits}`, 80, barHeight / 2);
    ctx.fillText(`⭐ ${powerUpsCollected}`, 140, barHeight / 2);
    ctx.fillText(`FR: x${playerStats.fireRate.toFixed(2)}`, 220, barHeight / 2);
    ctx.fillText(`FS: x${playerStats.bulletSpeed.toFixed(2)}`, 310, barHeight / 2);
    ctx.fillText(`PEN: ${playerStats.penetration}`, 400, barHeight / 2);
    ctx.fillText(`MS: ${playerStats.multishot}`, 470, barHeight / 2);
    ctx.fillText(`SIZE: x${playerStats.bulletSize.toFixed(1)}`, 540, barHeight / 2);
}

// ====================
// CARDS
// ====================
function openCardSelection() {
    gameState = "cardSelect";
    currentCards = pickRandomCards(3);
}

function pickRandomCards(n) {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
}

function drawCards() {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, width, height);
    const cardW = 180, cardH = 220, gap = 30;
    const startX = width / 2 - (cardW * 3 + gap * 2) / 2;
    const y = height / 2 - cardH / 2;
    ctx.textAlign = "center";
    currentCards.forEach((card, i) => {
        const x = startX + i * (cardW + gap);
        ctx.fillStyle = "#222"; ctx.fillRect(x, y, cardW, cardH);
        ctx.strokeStyle = "#fff"; ctx.strokeRect(x, y, cardW, cardH);
        ctx.fillStyle = "#fff"; ctx.font = "18px Arial";
        ctx.fillText(card.title, x + cardW / 2, y + 40);
        ctx.font = "14px Arial"; wrapText(card.desc, x + cardW / 2, y + 90, cardW - 20, 18);
    });
}

function wrapText(text, x, y, maxWidth, lineHeight) {
    const words = text.split(" ");
    let line = "";
    for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + " ";
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && i > 0) {
            ctx.fillText(line, x, y);
            line = words[i] + " ";
            y += lineHeight;
        } else { line = testLine; }
    }
    ctx.fillText(line, x, y);
}

// ====================
// TIROS
// ====================
function shoot() {
    const speed = playerStats.bulletSpeed;
    const shots = playerStats.multishot;
    const spreadAngle = 0.15;
    const spawnOffset = 8;

    for (let i = 0; i < shots; i++) {
        const t = shots === 1 ? 0.5 : i / (shots - 1);
        const angleOffset = (t - 0.5) * spreadAngle;
        const angle = player.angle + angleOffset;
        const offsetX = Math.cos(angle + Math.PI / 2) * (i - (shots - 1) / 2) * spawnOffset;
        const offsetY = Math.sin(angle + Math.PI / 2) * (i - (shots - 1) / 2) * spawnOffset;

        bullets.push({
            x: player.x + offsetX,
            y: player.y + offsetY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: playerStats.bulletSize,
            penetration: playerStats.penetration,
            lastHitFrame: -1
        });
    }
}

// ====================
// COLISÃO CIRCULO
// ====================
function circleCollision(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) < a.radius + b.radius;
}

// ====================
// WAVES
// ====================
function startWave(n) {
    wave = n;
    waveInProgress = true;

    // cria nova cobra
    const newSnakeLength = 100 + wave * 20;
    snake.segments = [];
    for (let i = 0; i < newSnakeLength; i++) {
        snake.segments.push({
            hp: 1,
            type: Math.random() < 0.1 ? "power" : "normal"
        });
    }

    // aumenta velocidade da cobra
    snake.speed = 0.35 + 0.05 * (wave - 1);
    snake.angleSpeed = 0.012 + 0.002 * (wave - 1);

    // spawn da cobra **próximo do player**, no centro da tela
    const minSpawnDistance = 80;  // distância mínima do player
    const maxSpawnDistance = 150; // distância máxima do player

    snake.headAngle = Math.random() * Math.PI * 2;
    snake.headRadius = minSpawnDistance + Math.random() * (maxSpawnDistance - minSpawnDistance);

    console.log(`Wave ${wave} iniciada!`);
}


function checkWaveProgress() {
    if (snake.segments.length === 0 && waveInProgress) {
        waveInProgress = false;
        openCardSelection();
    }
}

// ====================
// HANDLE CARD CLICK
// ====================
canvas.addEventListener("mousedown", handlePointer);
canvas.addEventListener("touchstart", handlePointer, { passive: false });

function handlePointer(e) {
    if (gameState !== "cardSelect") return;
    e.preventDefault();
    let clientX, clientY;
    if (e.touches) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
    else { clientX = e.clientX; clientY = e.clientY; }
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    const cardW = 180, cardH = 220, gap = 30;
    const startX = width / 2 - (cardW * 3 + gap * 2) / 2;
    const y = height / 2 - cardH / 2;

    currentCards.forEach((card, i) => {
        const x = startX + i * (cardW + gap);
        if (mx >= x && mx <= x + cardW && my >= y && my <= y + cardH) {
            card.apply();
            gameState = "playing";
            // inicia próxima wave se cobra acabou
            if (snake.segments.length === 0) {
                startWave(wave + 1);
            }
        }
    });
}
