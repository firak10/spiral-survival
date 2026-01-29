console.log("game.js carregado");

let width = 0;
let height = 0;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let hits = 0;
let powerUpsCollected = 0;

let frameCount = 0;

let gameState = "playing"; // playing | cardSelect
let currentCards = [];

const baseStats = {
    fireRate: 1,        // multiplicador (1 = normal)
    fireSpeed: 1,
    bulletSpeed: 3,      // multiplicador
    penetration: 0,     // quantos segmentos atravessa
    multishot: 1,       // quantidade de tiros
    bulletSize: 5       // multiplicador do raio
};

const playerStats = {
    fireRate: 1,        // multiplicador (1 = normal)
    fireSpeed: 1,
    bulletSpeed: 2,      // multiplicador
    penetration: 0,     // quantos segmentos atravessa
    multishot: 1,       // quantidade de tiros
    bulletSize: 1       // multiplicador do raio
};
const MIN_HIT_DISTANCE = 10;
console.log("fireRate:", playerStats.fireRate);

const baseBulletSpeed = 6;
const baseBulletRadius = 4;

const snake = {
    segments: [],
    headAngle: Math.random() * Math.PI * 2,
    headRadius: Math.max(width, height) + 500,

    speed: 0.35,          // avanço radial
    angleSpeed: 0.012,    // giro real

    angleSpacing: 0.32,   // separação angular
    radiusSpacing: 8,      // separação radial
    pushBack: 2,
    freezeTime: 0
};



const SNAKE_LENGTH = 120;

for (let i = 0; i < SNAKE_LENGTH; i++) {
    snake.segments.push({
        hp: 1,
        type: Math.random() < 0.1 ? "power" : "normal"
    });
}


// Ajusta o canvas ao tamanho da tela
function resize() {
    const dpr = window.devicePixelRatio || 1;

    width = window.innerWidth;
    height = window.innerHeight;

    canvas.style.width = width + "px";
    canvas.style.height = height + "px";

    canvas.width = width * dpr;
    canvas.height = height * dpr;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}



window.addEventListener("resize", resize);
resize();

// ============================
// GAME LOOP
// ============================
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

requestAnimationFrame(loop);


// ============================
// MOUSE TRACKING
// ============================ 
const mouse = {
    x: canvas.width / 2,
    y: canvas.height / 2
};

// touch support

let isTouching = false;
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


window.addEventListener("mousemove", e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
// ============================
// PLAYER
// ============================
const player = {
    x: 0,
    y: 0,
    radius: 12,
    angle: 0
};
// Atualiza a posição e o ângulo do jogador
function update() {
    if (gameState === "cardSelect") return;
    frameCount++;

    /* ======================
       1️⃣ PLAYER
    ====================== */
    player.x = width / 2;
    player.y = height / 2;

    player.angle = Math.atan2(
        mouse.y - player.y,
        mouse.x - player.x
    );

    /* ======================
       2️⃣ TIRO AUTOMÁTICO
    ====================== */
    const now = performance.now();
    const effectiveShotInterval = shotInterval / playerStats.fireRate;

    if (now - lastShot > effectiveShotInterval) {
        shoot();
        lastShot = now;
    }

    /* ======================
       3️⃣ ATUALIZA TIROS
    ====================== */
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        if (b.x < 0 || b.x > width || b.y < 0 || b.y > height) {
            bullets.splice(i, 1);
        }
    }

    /* ======================
    4️⃣ COLISÃO TIROS x COBRA
 ====================== */
    for (let i = bullets.length - 1; i >= 0; i--) {
        const bullet = bullets[i];
        let hitThisFrame = false;

        for (let j = 0; j < snake.segments.length; j++) {
            if (hitThisFrame) break;

            const angle = snake.headAngle + j * snake.angleSpacing;
            const radius = snake.headRadius + j * snake.radiusSpacing;

            const segmentPos = {
                x: width / 2 + Math.cos(angle) * radius,
                y: height / 2 + Math.sin(angle) * radius,
                radius: 5
            };
            if (bullet.lastHitFrame === frameCount) continue;

            if (circleCollision(bullet, segmentPos)) {
                bullet.lastHitFrame = frameCount;
                const segmentType = snake.segments[j].type;

                // remove segmento
                snake.segments.splice(j, 1);

                // pushback
                snake.headRadius += snake.radiusSpacing * snake.pushBack;

                // freeze
                snake.freezeTime = Math.max(snake.freezeTime, 10);

                // penetração
                bullet.penetration--;

                // estatísticas
                hits++;
                if (segmentType === "power") {
                    powerUpsCollected++;
                    openCardSelection();
                }

                // remove tiro se acabou a penetração
                if (bullet.penetration < 0) {
                    bullets.splice(i, 1);
                }

                hitThisFrame = true; // 🔥 A CHAVE
                // força o tiro a sair da massa da cobra
                bullet.x += bullet.vx * 2;
                bullet.y += bullet.vy * 2;
            }
        }
    }



    /* ======================
       5️⃣ MOVIMENTO DA COBRA
    ====================== */
    if (snake.freezeTime > 0) {
        snake.freezeTime--;
    } else {
        snake.headAngle -= snake.angleSpeed;
        snake.headRadius -= snake.speed;
    }

    snake.headRadius = Math.max(snake.headRadius, 0);

    /* ======================
       6️⃣ COLISÃO COBRA x PLAYER
    ====================== */
    const headX = width / 2 + Math.cos(snake.headAngle) * snake.headRadius;
    const headY = height / 2 + Math.sin(snake.headAngle) * snake.headRadius;

    if (
        circleCollision(
            { x: headX, y: headY, radius: 6 },
            { x: player.x, y: player.y, radius: player.radius }
        )
    ) {
        alert("Game Over");
        window.location.reload();
    }
}

function openCardSelection() {
    gameState = "cardSelect";
    currentCards = pickRandomCards(3);
}

function pickRandomCards(n) {
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, n);
}

// ============================
// cards
// ============================
const cards = [
    {
        id: "fireRate",
        title: "🔥 Gatilho Rápido",
        desc: "Aumenta a velocidade de disparo",
        apply() {
            playerStats.fireRate *= 1.25;
        }
    },
    {
        id: "bulletSpeed",
        title: "⚡ Munição Veloz",
        desc: "Projéteis mais rápidos",
        apply() {
            playerStats.bulletSpeed += 1;
        }
    },
    {
        id: "penetration",
        title: "🪓 Perfuração",
        desc: "Balas atravessam inimigos",
        apply() {
            playerStats.penetration += 1;
        }
    },
    {
        id: "multishot",
        title: "🔱 Tiro Triplo",
        desc: "Dispara mais projéteis",
        apply() {
            playerStats.multishot += 1;
        }
    },
    {
        id: "bulletSize",
        title: "💥 Bala Pesada",
        desc: "Projéteis maiores",
        apply() {
            playerStats.bulletSize += 1;
        }
    }
];

function drawHUD() {
    const barHeight = 40;

    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, width, barHeight);

    ctx.fillStyle = "#ffffff";
    ctx.font = "13px Arial";
    ctx.textBaseline = "middle";

    ctx.fillText(`🐍 ${snake.segments.length}`, 20, barHeight / 2);
    ctx.fillText(`🎯 ${hits}`, 80, barHeight / 2);
    ctx.fillText(`⭐ ${powerUpsCollected}`, 140, barHeight / 2);

    ctx.fillText(`FR: x${playerStats.fireRate.toFixed(2)}`, 220, barHeight / 2);
    ctx.fillText(`FS: x${playerStats.fireSpeed.toFixed(2)}`, 310, barHeight / 2);
    ctx.fillText(`PEN: ${playerStats.penetration}`, 400, barHeight / 2);
    ctx.fillText(`MS: ${playerStats.multishot}`, 470, barHeight / 2);
    ctx.fillText(`SIZE: x${playerStats.bulletSize.toFixed(1)}`, 540, barHeight / 2);
}


// Desenha o jogador no canvas
function draw() {
    // fundo
    ctx.fillStyle = "#111";
    ctx.fillRect(0, 0, width, height);

    // cobra
    for (let i = 0; i < snake.segments.length; i++) {
        const segment = snake.segments[i];

        const angle = snake.headAngle + i * snake.angleSpacing;
        const radius = snake.headRadius + i * snake.radiusSpacing;

        const x = width / 2 + Math.cos(angle) * radius;
        const y = height / 2 + Math.sin(angle) * radius;

        ctx.fillStyle = segment.type === "power"
            ? "#ff44aa"
            : "#8844ff";

        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    }
    // desenha linha conectando segmentos
    ctx.strokeStyle = "rgba(255,255,255,0.15)";
    ctx.beginPath();

    for (let i = 0; i < snake.segments.length; i++) {
        const angle = snake.headAngle + i * snake.angleSpacing;
        const radius = snake.headRadius + i * snake.radiusSpacing;

        const x = width / 2 + Math.cos(angle) * radius;
        const y = height / 2 + Math.sin(angle) * radius;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
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

    ctx.strokeStyle = "#ffffff";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(player.radius + 15, 0);
    ctx.stroke();

    ctx.restore();

    // debug centro (opcional)
    ctx.fillStyle = "red";
    ctx.fillRect(width / 2 - 2, height / 2 - 2, 4, 4);

    // HUD
    drawHUD();

    if (gameState === "cardSelect") {
    drawCards();
}

function drawCards() {
    ctx.fillStyle = "rgba(0,0,0,0.7)";
    ctx.fillRect(0, 0, width, height);

    const cardW = 180;
    const cardH = 220;
    const gap = 30;
    const startX = width / 2 - (cardW * 3 + gap * 2) / 2;
    const y = height / 2 - cardH / 2;

    ctx.textAlign = "center";

    currentCards.forEach((card, i) => {
        const x = startX + i * (cardW + gap);

        ctx.fillStyle = "#222";
        ctx.fillRect(x, y, cardW, cardH);

        ctx.strokeStyle = "#fff";
        ctx.strokeRect(x, y, cardW, cardH);

        ctx.fillStyle = "#fff";
        ctx.font = "18px Arial";
        ctx.fillText(card.title, x + cardW / 2, y + 40);

        ctx.font = "14px Arial";
        wrapText(card.desc, x + cardW / 2, y + 90, cardW - 20, 18);
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
        } else {
            line = testLine;
        }
    }
    ctx.fillText(line, x, y);
}



}

// ============================
// BULLETS
// ============================ 
const bullets = [];

let lastShot = 0;
const shotInterval = 1000; // 1 segundo
// Atira ao clicar com o mouse

function shoot() {
    const speed = playerStats.bulletSpeed;
    const shots = playerStats.multishot;

    const spreadAngle = 0.15;   // abertura total
    const spawnOffset = 8;      // separação inicial entre balas

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


// Checa colisão entre dois círculos
function circleCollision(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) < a.radius + b.radius;
}

canvas.addEventListener("click", e => {
    if (gameState !== "cardSelect") return;

    const mx = e.clientX;
    const my = e.clientY;

    handleCardClick(mx, my);
});
function handleCardClick(mx, my) {
    const cardW = 180;
    const cardH = 220;
    const gap = 30;
    const startX = width / 2 - (cardW * 3 + gap * 2) / 2;
    const y = height / 2 - cardH / 2;

    currentCards.forEach((card, i) => {
        const x = startX + i * (cardW + gap);

        if (
            mx >= x && mx <= x + cardW &&
            my >= y && my <= y + cardH
        ) {
            card.apply();
            gameState = "playing";
        }
    });
}
