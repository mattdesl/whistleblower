if (typeof window.endless === 'undefined')
    window.endless = false

WebFontConfig = {
    google: { families: [ 'Source+Sans+Pro:300,400,700:latin' ] }
  };
  (function() {
    var wf = document.createElement('script');
    wf.src = ('https:' == document.location.protocol ? 'https' : 'http') +
      '://ajax.googleapis.com/ajax/libs/webfont/1/webfont.js';
    wf.type = 'text/javascript';
    wf.async = 'true';
    var s = document.getElementsByTagName('script')[0];
    s.parentNode.insertBefore(wf, s);
  })();


//will be replaced by a smaller loop / GL setup
require('canvas-testbed')(render, start, {
    // width: 500, height: 500
})


var PI2 = Math.PI*2,
    radius = 25,
    MAX_PARTICLES = 60,
    MAX_ENEMIES = 20,
    START_ENEMIES = 2,
    P_RADIUS = 8,
    REPLAY_DUR = 1000,
    enemies = START_ENEMIES,
    life = 1,
    replaying,
    fin,
    kdur = 1000,
    transition = '-moz-transition: opacity 1.0s;  -webkit-transition: opacity 1.0s;'


var AudioContext = window.webkitAudioContext || window.AudioContext || window.mozAudioContext,
    audioContext = AudioContext && new AudioContext(),
    getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia,
    analyser,
    waveform,
    intro = document.createElement("span"),
    wavesum,
    time = 0,
    loudest = 0.25,
    particles = [],
    frequencies,
    supported = AudioContext && getUserMedia;

getUserMedia && getUserMedia.call(navigator, {audio:true, video:false}, function(stream) {
    intro.style.opacity = '0.0'

    setTimeout(function() {
        analyser = audioContext.createAnalyser()
        audioContext.createMediaStreamSource(stream).connect(analyser)

        waveform = new Uint8Array(analyser.frequencyBinCount)
        frequencies = new Uint8Array(analyser.frequencyBinCount)
        wavesum = new Uint8Array(waveform)
        
        intro.style.display='none'
    }, 1000)
    
}, getUserMedia)

function deadShooters(p) { 
    return !p.alive && !p.enemy
}

function ease(t) {
    // return t
    // return t > 0.5
    // ? +2.0 * t * t
    // : -2.0 * t * t + (4.0 * t) - 1.0;
  return Math.sin((t - 1.0) * Math.PI/2) + 1.0;
    // return 0.5 * 1.0 - Math.cos(t * Math.PI);
    // return Math.sin(t * Math.PI/2);
}

function ease2(t) {
    return t == 1.0 ? t : 1.0 - Math.pow(2.0, -10.0 * t);

  // return Math.sin((t - 1.0) * Math.PI/2) + 1.0;
    // return 0.5 * 1.0 - Math.cos(t * Math.PI);
    // return Math.sin(t * Math.PI/2);
}

function render(ctx, width, height, dt) {
    time+=dt
    var linear = ctx.createLinearGradient(width, 0, width, height)
    linear.addColorStop(0, '#e47431')
    linear.addColorStop(1, '#e88832')
    ctx.fillStyle = linear
    // ctx.clearRect(0,0,width,height)
    ctx.fillRect(0, 0, width, height)
    
    var cx = ~~(width/2),
        cy = ~~(height/2),
        dur = 1000

    if(!analyser) {
        return
    }

    ctx.fillStyle = ctx.strokeStyle = '#fff'
    ctx.globalAlpha = 1

    // ctx.beginPath()
    // var r = 100
    // ctx.arc(cx, cy, r, 0, PI2, false)
    // ctx.fill()
    
    // ctx.arc(width/2,height/2, r2, 0, PI2, false)
        
    var pad = 25, thick = 4
    if (!endless) {
        ctx.fillRect(pad+5, height-pad-thick, 100 * life, thick)
        ctx.fillRect(pad, ~~(height-pad-thick*1.5), 2, 8)
        ctx.fillRect(pad+108, ~~(height-pad-thick*1.5), 2, 8)
    }


    life = fin ? 0 : Math.max(0, Math.min(1.0, life + 0.0005))

    analyser.getByteTimeDomainData(waveform)
    analyser.getByteFrequencyData(frequencies)

    // var lowfreq = frequencies.subarray(50, 90)
    var lowfreq = frequencies.subarray(50, 80)
        
    var count = 16,
        avgs = new Float32Array(count),
        entries = new Float32Array(count)
    for (var i=0; i<lowfreq.length; i++) {

        var index = ~~(i/lowfreq.length * count),
            a = ease(lowfreq[i]/(256))
        
        avgs[ index ] += a
        entries[ index ] ++
    }


    function shoot() {
        var shooters = particles.filter(deadShooters).slice(0, 1)
            steps = 360
        for (var i=0; i<=steps; i++) {
            var t = (i)/(steps-1),
                off = (steps/(count*2)*Math.PI/180),
                a = Math.max(off, ((t * PI2) - off)),
                idx = ~~(t * avgs.length) % avgs.length,
                avg = ( avgs[ idx ] / entries[ idx ] );
                // console.log(a)
            if (avg > loudest) {
                for (var j=0; j<shooters.length; j++) {
                    shooters[j].reset(width,height)
                    shooters[j].shoot(idx === 0 ? off : a, width, height)

                }
            }
        }
    }

    function graph(px, py, steps, rt, fill, rot, ptype) {
        ctx.beginPath()
        for (var i=0; i<=steps; i++) {
            var t = (i)/(steps-1),
                a = (t * PI2) + (rot||0),
                idx = ~~(t * avgs.length) % avgs.length,
                avg = ( avgs[ idx ] / entries[ idx ] ),
                r2 = ptype ? (rt + avgs[0]*5)*ptype.vizSize : Math.min(rt*3, rt + avg * 75),
                x = Math.cos(a) * r2 + px,
                y = Math.sin(a) * r2 + py
            // ctx.fillRect(x, y, 5, 5)
            ctx.lineTo(x, y)
        }

        // ctx.closePath()
        if (fill) {
            ctx.lineTo(px, py)
            ctx.fill()
        }
        else ctx.stroke()
    }
        
    function renderParticles(ctx, width, height) {
        // ctx.beginPath()
        for (var i=particles.length-1; i>=0; i--) {
            var p = particles[i],
                x = p.position[0],
                y = p.position[1]
            if ((p.enemy && !p.attacking) || (!p.alive && !p.enemy))
                continue

            ctx.fillStyle = i>MAX_PARTICLES ? '#be3131': '#fff'
            graph(x, y, p.sides, P_RADIUS * p.size, p.fill, p.angle, p)
        }
        // ctx.fill()
    }
    
    ctx.lineWidth = 1
    // ctx.lineJoin = 'round'
        
    var anim = fin ? 1.0 : (time < dur ? ease2(time/dur) : 1.0)
    
    step(dt, width, height)
    renderParticles(ctx, width, height)

    ctx.fillStyle = '#fff'
    ctx.globalAlpha = 0.2
    graph(cx, cy, 360, (radius+4)*anim, true)
    ctx.globalAlpha = 1.0
    graph(cx, cy, 360, radius*anim, true)

    
    shoot()


    if (!endless && (life < 0.01 || fin)) {
        if (!fin) {
            time = 0
            intro.innerHTML = 'you died<br><font>click to replay</font>'
            var child = caption()
            
            intro.style.display = 'block'
            intro.style.opacity = '0.0'
            setTimeout(function() { 
                intro.style.opacity = '1.0' 
                setTimeout(function() {
                    child && (child.style.opacity = '1.0')
                }, 700)
            }, 1000)
        }
        fin = true

        ctx.fillStyle = '#e47431'
        dur = replaying ? REPLAY_DUR : 2000
        var alpha = Math.min(1, (time < dur ? ease2(time/dur) : 1.0))
        if (replaying) 
            alpha = 1.-Math.min(1, time/dur)
        ctx.globalAlpha = alpha*0.75
        ctx.fillRect(0,0,width,height)
    }
}

function rnd2() {
    return [Math.random()*2-1,Math.random()*2-1]
}

function Particle(width,height,enemy) {
    this.enemy = enemy
    this.reset(width,height)
    this.attacking = false
}
var Prt = Particle.prototype
Prt.reset = function(width, height) {
    var a = Math.random()*PI2,
        enemy = this.enemy,
        x = width/2, 
        y = height/2

    if (enemy) {
        x += Math.cos(a) * Math.max(radius * 4, Math.random()*width/2)
        y += Math.sin(a) * Math.max(radius * 4, Math.random()*width/2)
    }

    // var x = width/2 + ,
    //     y = height/2 + 

    this.angle = 0
    this.sides = this.enemy ? 6 : (~~(Math.random()*2) + 4)
    this.fill = this.enemy || Math.random()>0.5
    this.rot = Math.random()
    this.position = [x,y]
    this.velocity = rnd2()
    this.accel = [0,0]
    this.size = this.enemy ? Math.random()*2 : Math.random()
    this.vizSize = 1.0
    this.killTime = 0
    this.killing = false
    this.alive = false
    return this
}
Prt.shoot = function(a,width,height) {
    var j1 = Math.random()*2-1,
        j2 = Math.random()*2-1,
        amt = 0.3
    var x = Math.cos(a+j1*amt),
        y = Math.sin(a+j2*amt),
        ac = Math.random()*0.15

    this.velocity = [x, y]
    this.accel = [x*ac, y*ac]
    this.position = [width/2 + x*radius, height/2 + y*radius]
    this.alive = true
}


function step(dt, width, height) {
    var cx = width/2,
        cy = height/2
    for (var i=0; i<particles.length; i++) {
        var g = 0.02,
            p = particles[i],
            velocity = p.velocity,
            pos = p.position,
            nx = pos[0] - cx,
            ny = pos[1] - cy,
            enemy = p.enemy,
            spd = enemy ? 0.15 : 1.0
            acc = p.accel,
            nL = Math.sqrt(nx*nx + ny*ny),
            circX = cx - pos[0],
            circY = cy - pos[1],
            inside = Math.sqrt(circX*circX + circY*circY) <= radius

        // console.log(i-MAX_PARTICLES)
        if (i > MAX_PARTICLES && i < MAX_PARTICLES+enemies)
            p.attacking = true
        if (p.enemy && !p.attacking)
            continue

        if (p.killing) {
            p.killTime += dt
            p.vizSize = 1 - (p.killTime > kdur ? 1.0 : ease2(p.killTime / kdur))
            // if (p.killTime > 400)
            //     debugger
            if (p.killTime > kdur)
                p.reset(width,height)
        }

        for (var j=0; j<particles.length; j++) {
            // if (i > MAX_PARTICLES || j <= MAX_PARTICLES)
            //     continue

            var op = particles[j],
                opos = op.position,
                oradius = P_RADIUS * op.size,
                odx = opos[0] - pos[0],
                ody = opos[1] - pos[1],
                odist = Math.sqrt(odx*odx + ody*ody),
                hit = odist <= P_RADIUS*p.size + oradius

            if (!p.killing && hit && i !== j && p.enemy && !op.enemy && op.alive) {
                p.killing = true
                p.killTime = 0
                // p.reset(width,height)
            }
        }

        nx /= nL ? nL : 1
        ny /= nL ? nL : 1 

        velocity[0] += acc[0] 
        velocity[1] += acc[1] 

        acc[0] *= 0.98
        acc[1] *= 0.98

        p.angle += (nx+ny)*g/4 * p.rot

        if (p.enemy) {
            velocity[0] -= nx*g
            velocity[1] -= ny*g
        }

        pos[0] += velocity[0]*spd * dt*0.03
        pos[1] += velocity[1]*spd * dt*0.03

        if (pos[0]<0||pos[0]>width ||pos[1]<0||pos[1]>height) {
            if (p.enemy)
                p.reset(width,height)
            else
                p.alive = false
        } else if (inside && p.enemy && !p.killing) {
            if (p.attacking)
                life -= 0.05 * p.size
            p.reset(width, height)
        }
    }
}

function caption() {
    var child = intro.getElementsByTagName('font')[0]
    child.style.cssText = 'font-weight: 500; font-size: 18px; opacity: 0.0;'+transition
    return child
}

function start(ctx, width, height) {
    ctx.canvas.style.border = '15px solid #fff'
    ctx.canvas.style.boxSizing = 'border-box'

    window.addEventListener("click", function() {
        if (!fin || replaying)
            return

        replaying = true
        time = 0
        intro.style.opacity = '0.0'
        particles.forEach(function(p) {
            p.attacking = false
            p.alive = false
        })
        setTimeout(function() {
            fin = false
            life = 1
            time = 0
            enemies = START_ENEMIES
            replaying = false
            particles.forEach(function(p) {
                p.reset(width, height)
            })
        }, REPLAY_DUR)
    })

    var i = MAX_PARTICLES + MAX_ENEMIES
    while (i-- >= 0) {
        particles[i] = new Particle(width,height, i > MAX_PARTICLES)
        particles[i].alive = false
    }

    intro.innerHTML = supported
                ? 'please allow microphone<br><font>whistle to shoot</font>' : 'requires Web Audio API<br><font>works best in Chrome</font>'
    
    intro.style.cssText = "position:fixed; opacity: 0.0; top:50%; width:100%; text-align:center; -webkit-font-smoothing: antialiased; font: 20px 'Source Sans Pro', sans-serif; color: white; line-height: 25px; font-weight: 700;"+ transition
    var child = caption()

    setTimeout(function() {
        if (!analyser) {
            intro.style.opacity='1.0'
            child && (child.style.opacity = '0.0')
        }
        setTimeout(function() {
            child && (child.style.opacity = '1.0')
        }, 700)
    }, 1000)
    document.body.appendChild(intro)



    setInterval(function() {
        enemies++
    }, 3000)
}