console.log("game.js carregado");

let width = 0;
let height = 0;
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

let hits = 0;
let powerUpsCollected = 0;


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
    if (now - lastShot > shotInterval) {
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

        for (let j = 0; j < snake.segments.length; j++) {
            const angle = snake.headAngle + j * snake.angleSpacing;
            const radius = snake.headRadius + j * snake.radiusSpacing;

            const segmentPos = {
                x: width / 2 + Math.cos(angle) * radius,
                y: height / 2 + Math.sin(angle) * radius,
                radius: 5
            };

            if (circleCollision(bullet, segmentPos)) {

                // guarda o tipo ANTES de remover
                const segmentType = snake.segments[j].type;

                // remove tiro
                bullets.splice(i, 1);

                // remove segmento
                snake.segments.splice(j, 1);

                // pushback (UMA VEZ)
                snake.headRadius += snake.radiusSpacing * snake.pushBack;

                // freeze
                snake.freezeTime = Math.max(snake.freezeTime, 10);

                // estatísticas
                hits++;
                if (segmentType === "power") {
                    powerUpsCollected++;
                }

                break;
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
function drawHUD() {
    const barHeight = 20;

    // fundo
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, width, barHeight);

    // texto
    ctx.fillStyle = "#ffffff";
    ctx.font = "14px Arial";
    ctx.textBaseline = "middle";

    ctx.fillText(`🐍 Segmentos: ${snake.segments.length}`, 20, barHeight / 2);
    ctx.fillText(`🎯 Hits: ${hits}`, 200, barHeight / 2);
    ctx.fillText(`⭐ Power-ups: ${powerUpsCollected}`, 340, barHeight / 2);
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
}

// ============================
// BULLETS
// ============================ 
const bullets = [];

let lastShot = 0;
const shotInterval = 1000; // 1 segundo
// Atira ao clicar com o mouse

function shoot() {
    console.log("SHOT AT", player.x, player.y);
    const speed = 6;

    bullets.push({
        x: player.x,
        y: player.y,
        vx: Math.cos(player.angle) * speed,
        vy: Math.sin(player.angle) * speed,
        radius: 4
    });
}

// Checa colisão entre dois círculos
function circleCollision(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) < a.radius + b.radius;
}

