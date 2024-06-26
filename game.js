"use strict";

import { createPipes, updatePipes, deletePipes, stopPipes, } from "./pipesFunctions.js";
import { width, height } from "./properties.js"

let isPressed = false;
let gameIsActive = false;
let birdIsDead = false;
let score = 0;
let maxScore = 0;
let distanceBetween = 95;
let birdVelocity = -250;
let birdGravity = 800;
let gameSpeed = 150;

(() => {
  const config = {
    type: Phaser.AUTO,
    width: width,
    height: height,
    physics: {
      default: "arcade",
      arcade: {
          debug: false
      }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
  };
  
  const game = new Phaser.Game(config);
  
  const canvas = document.querySelector("canvas");
  canvas.id = "canvas";
  
  window.addEventListener("resize", resize, false);
  resize();

  function resize () {
    let scale = window.innerWidth / width > window.innerHeight / height ? window.innerHeight / height : window.innerWidth / width;
    scale = scale <= 1.5 ? scale : 1.5;
    scale *= 0.8;
    canvas.style = `width: ${width * scale}px; height: ${height * scale}px;`;
  }
})();

class UI {
  constructor(group, add) {
    this.group = group;
    this.groupObjects = group.children.entries;
    this.add = add;
  }

  showScore(score, distanceSize = 30, deletePrevious = true, sizeMultiplier = 1, startPositionX, startPositionY = 25) {
    if(deletePrevious) {
      this.removeScore();
    }

    const numbers = score.toString().split("");
    let startPosition;

    if(startPositionX) {
      startPosition = startPositionX
    } else {
      startPosition = width / 2 - (numbers.length - 1) * distanceSize / 2;
    }

    for (let i = 0; i < numbers.length; i++) {
      const number = this.group.add(this.add.image(startPosition + distanceSize * i, startPositionY, numbers[i]).setOrigin(0.5, 0).setScale(sizeMultiplier));
      number.depth = 5;
    }
  }

  showScorePanel(score, maxScore) {
    this.removeScore();

    const scoreText = this.add.text(50, 160, "score:", { fontSize: "40px", fill: "#fff", fontFamily: "CustomFont"});
    this.showScore(score, 20, false, 0.7, 130, 170);

    const maxScoreText = this.add.text(50, 190, "max score:", { fontSize: "40px", fill: "#fff", fontFamily: "CustomFont"});
    this.showScore(maxScore, 20, false, 0.7, 185, 200);
    
    scoreText.depth = 5;
    maxScoreText.depth = 5;

    this.group.add(scoreText);
    this.group.add(maxScoreText);
  }

  removeScore() {
    while(this.groupObjects.length > 0){
      this.groupObjects[0].destroy();
    }
  }
}

class ClickHandler {
  constructor(mouse, keybourd, pointer) {
    this.mouse = mouse;
    this.keybourd = keybourd;
    this.pointer = pointer;
  }

  wasInteracted() {
    return this.keybourd.space.isDown || this.mouse.isDown || this.pointer.isDown;
  }
}

function preload ()
{
  this.load.image("sky", "assets/images/background-day.png");
  this.load.image("base", "assets/images/base.png");
  this.load.image("pipe", "assets/images/pipe-green.png")

  this.load.image("startMessage", "assets/images/message.png")

  this.load.image("bird1", "assets/images/yellowbird-downflap.png")
  this.load.image("bird2", "assets/images/yellowbird-midflap.png")
  this.load.image("bird3", "assets/images/yellowbird-upflap.png")

  for (let i = 0; i <= 9; i++) {
    this.load.image(`${i}`, `assets/images/${i}.png`)
  }

  this.load.audio("die", ["assets/sounds/die.mp3"]);
  this.load.audio("flap", ["assets/sounds/flap.mp3"]);
  this.load.audio("hit", ["assets/sounds/hit.mp3"]);
  this.load.audio("point", ["assets/sounds/point.mp3"]);
}

function create ()
{
  this.add.image(0, 0, "sky").setOrigin(0, 0);

  this.anims.create({
    key: "fly",
    frames: [
        { key: "bird1" },
        { key: "bird2" },
        { key: "bird3" },
    ],
    frameRate: 10,
    repeat: -1
  });

  this.pipes = this.add.group();
  this.bases = this.add.group();
  this.passColliders = this.add.group();
  this.score = this.add.group();

  this.cursors = this.input.keyboard.createCursorKeys();
  this.pointer = this.input.activePointer;
  this.mobilePointer = this.input.pointer1;

  this.ui = new UI(this.score, this.add);
  this.clickHandler = new ClickHandler(this.pointer, this.cursors, this.mobilePointer);

  const base1 = this.physics.add.image(0, 400, "base").setOrigin(0, 0).setImmovable(true);
  const base2 = this.physics.add.image(336, 400, "base").setOrigin(0, 0).setImmovable(true);
  base1.depth = 2;
  base2.depth = 2;
  this.bases.add(base1);
  this.bases.add(base2);

  this.wall = this.add.zone(0, 0, width, 25).setOrigin(0, 2)
  this.physics.world.enable(this.wall);
  this.wall.body.setAllowGravity(false);
  this.wall.body.moves = false;

  this.bird = this.physics.add.sprite(144, 256, "bird2");
  this.bird.depth = 1;

  this.physics.add.collider(this.bird, this.wall);
  this.physics.add.collider(this.bird, this.bases, die, null, this);
  this.physics.add.overlap(this.bird, this.passColliders, passPipes, null, this);
  this.physics.add.overlap(this.bird, this.pipes, die, null, this);

  this.die = this.sound.add("die", { loop: false, volume: 0.5 });
  this.flap = this.sound.add("flap", { loop: false, volume: 0.18  });
  this.hit = this.sound.add("hit", { loop: false, volume: 0.5  });
  this.point = this.sound.add("point", { loop: false, volume: 0.5  });

  restartGame.call(this);
}

function updateBases(bases) {
  if(bases[0].x <= -336) {
    bases[0].x = bases[1].x + 336;
  } else if (bases[1].x <= -336) {
    bases[1].x = bases[0].x + 336;
  }
}

function updateBird(bird) {
  if (bird.body.velocity.y < 0){
    bird.angle = -45;
  } else if (bird.body.velocity.y < 300) {
    bird.angle = (bird.angle + 90 * (bird.body.velocity.y) / 300) / 2;
  } else if (bird.body.velocity.y > 300) {
    bird.angle = 90;
  }

  if (bird.body.velocity.y > 300) {
    setDivingAnimation(bird);
  } else {
    setAnimationFly(bird);
  }
}

function startGame() {
  console.log("Start");
  this.bird.setGravityY(birdGravity);
  gameIsActive = true;

  this.createPipesInterval = setInterval(() => {
    createPipes(this.pipes, this.passColliders, distanceBetween, gameSpeed, this.physics.add)
  }, 1500)

  this.startMessage.destroy();

  score = 0;
  this.ui.showScore(score);
}

function passPipes (bird, collider) {
  if(!collider.wasPassed){
    collider.destroy();
    score++;
    this.point.play();
    this.ui.showScore(score);
  }
}

function restartGame() {
  console.log("restart")
  this.bird.setPosition(144, 256);
  this.bird.setGravity(0);
  this.bird.setVelocity(0);
  if(this.fallAnimation){
    this.fallAnimation.stop();
  }
  this.bird.angle = 0;
  setAnimationFly(this.bird);
  

  this.ui.removeScore();

  isPressed = false;
  gameIsActive = false;
  birdIsDead = false;

  deletePipes(this.pipes.children.entries);
  startBases(this.bases.children.entries)

  this.startMessage = this.add.image(width/2, height/2 - 85, "startMessage").setOrigin(0.5, 0.5).setScale(0.7);
  this.startMessage.depth = 6;
}

function die() {
  if (!birdIsDead){
    console.log("die");
    this.hit.play();
    
    birdIsDead = true;
    // gameIsActive = false
    setDivingAnimation(this.bird);

    this.fallAnimation = this.tweens.add({
      targets: this.bird,
      angle: 90,
      duration: 250,
    })

    this.passColliders.clear(true, true);

    clearInterval(this.createPipesInterval);
    stopBases(this.bases.children.entries);
    stopPipes(this.pipes.children.entries);

    maxScore = maxScore < score ? score : maxScore;
    this.ui.showScorePanel(score, maxScore);

    setTimeout(() => gameIsActive = false, 200)
  }
}

function setAnimationFly(bird) {
  if(!bird.anims.isPlaying) {
    bird.anims.play("fly");
  }
}

function setDivingAnimation(bird) {
  bird.anims.stop();
  bird.setTexture("bird2")
}

function stopBases(bases) {
  bases.forEach(base => {
    base.setVelocity(0, 0);
  });
}

function startBases(bases) {
  bases.forEach(base => {
    base.setVelocityX(-gameSpeed);
  });
}

function flap() {
  this.bird.setVelocityY(birdVelocity);
  this.flap.play();
}

function update ()
{
  if(birdIsDead && gameIsActive) {
    return;
  }

  if(this.clickHandler.wasInteracted() !== isPressed && !isPressed) {
    if (birdIsDead) {
      restartGame.call(this);
      isPressed = this.clickHandler.wasInteracted();
      return;
    }

    if (!gameIsActive) {
      startGame.call(this);
    }
    flap.call(this);
  } 

  isPressed = this.clickHandler.wasInteracted() ;

  if (birdIsDead) {
    return;
  }

  updateBases(this.bases.children.entries);
  updatePipes(this.pipes.children.entries);
  updateBird(this.bird);
}