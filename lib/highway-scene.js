/* Highway Rush: self-contained procedural art, using the bundled Three.js r147.
   No models, textures, fonts or other assets are fetched from third parties. */
(function () {
  'use strict';
  function create(T, canvas, options) {
    const { roadWidth, laneWidth, lanes, segmentLength, segmentCount } = options;
    // r147 defaults to legacy linear handling of hex colours; opt into sRGB input.
    T.ColorManagement.legacyMode = false;
    const mobile = matchMedia('(pointer: coarse)').matches;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = .95;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const scene = new T.Scene();
    scene.fog = new T.Fog(0xd9b09a, 100, 610);
    const camera = new T.PerspectiveCamera(58, 1, .12, 1600);
    const sunDirection = new T.Vector3(-.65, .27, -.72).normalize();
    const hemi = new T.HemisphereLight(0xc4ddff, 0x665743, .7);
    scene.add(hemi);
    const sun = new T.DirectionalLight(0xffdab0, 1.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -22, right: 22, top: 30, bottom: -30, near: 1, far: 180 });
    sun.shadow.bias = -.00025;
    sun.shadow.normalBias = .025;
    scene.add(sun, sun.target);
    const fill = new T.DirectionalLight(0xb0d7ff, .25);
    fill.position.set(2, 5, 3);scene.add(fill);

    let seed = 74021;
    function random() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
    function texture(width, height, paint) {
      const c = document.createElement('canvas');c.width = width;c.height = height;
      paint(c.getContext('2d'), width, height);
      const t = new T.CanvasTexture(c);t.encoding = T.sRGBEncoding;
      t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
      return t;
    }
    const asphalt = texture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#585956';ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 40000; i++) {
        const v = 60 + Math.floor(random() * 75);
        ctx.fillStyle = `rgba(${v},${v},${v},.45)`;
        ctx.fillRect(random() * w, random() * h, 1.5, 1.5);
      }
      for (let i = 0; i < 12; i++) {
        const x = random() * w;
        ctx.strokeStyle = 'rgba(28,31,34,.13)';ctx.lineWidth = 1 + random() * 3;
        ctx.beginPath();ctx.moveTo(x, 0);ctx.bezierCurveTo(x + 5, 160, x - 9, 360, x + 2, 512);ctx.stroke();
      }
    });
    asphalt.wrapS = asphalt.wrapT = T.RepeatWrapping;asphalt.repeat.set(2, 14);
    const groundTexture = texture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = '#aaa58a';ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) {
        ctx.fillStyle = random() > .5 ? '#b8b298' : '#8c9873';ctx.globalAlpha = .3;
        ctx.fillRect(random() * w, random() * h, 2, 2);
      }
      ctx.globalAlpha = 1;
    });
    groundTexture.wrapS = groundTexture.wrapT = T.RepeatWrapping;groundTexture.repeat.set(20, 12);
    const shadowTexture = texture(64, 64, (ctx, w, h) => {
      const grad = ctx.createRadialGradient(32, 32, 6, 32, 32, 32);
      grad.addColorStop(0, 'rgba(0,0,0,.8)');grad.addColorStop(.5, 'rgba(0,0,0,.45)');grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;ctx.fillRect(0, 0, w, h);
    });

    const skyMaterial = new T.ShaderMaterial({
      side: T.BackSide, depthWrite: false, fog: false,
      uniforms: { sunDir: { value: sunDirection } },
      vertexShader: 'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform vec3 sunDir;varying vec3 vDir;
        void main(){
          vec3 d=normalize(vDir);float h=max(d.y,0.);
          vec3 col=mix(vec3(.8,.42,.22),vec3(.065,.22,.43),pow(h,.48));
          col=mix(col,vec3(.9,.65,.4),exp(-abs(d.y)*16.)*.36);
          float s=max(dot(d,sunDir),0.);
          col+=vec3(1.,.58,.23)*pow(s,14.)*.22;
          col+=vec3(1.,.74,.4)*pow(s,350.)*.4;
          col+=vec3(5.,3.5,1.8)*smoothstep(.99935,.9997,s);
          float wisps=sin(d.x*21.+d.y*67.+sin(d.z*16.)*2.);
          col+=vec3(.17,.11,.08)*smoothstep(.5,1.,wisps)*smoothstep(.12,.25,d.y)*(1.-smoothstep(.28,.5,d.y));
          gl_FragColor=vec4(col,1.);
          #include <tonemapping_fragment>
          #include <encodings_fragment>
        }`
    });
    const skyDome = new T.Mesh(new T.SphereGeometry(1200, 24, 16), skyMaterial);scene.add(skyDome);
    // Bake a small environment map once. It supplies clear sky/ground reflections on paint and glass.
    const envScene = new T.Scene();
    const envSky = new T.Mesh(new T.SphereGeometry(50, 24, 16), skyMaterial);envScene.add(envSky);
    const envGround = new T.Mesh(new T.PlaneGeometry(200, 200), new T.MeshBasicMaterial({ color: 0x50453f }));
    envGround.rotation.x = -Math.PI / 2;envGround.position.y = -2;envScene.add(envGround);
    const pmrem = new T.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(envScene, .03, .1, 150);
    scene.environment = environment.texture;
    pmrem.dispose();envSky.geometry.dispose();envGround.geometry.dispose();envGround.material.dispose();

    const materials = {
      asphalt: new T.MeshStandardMaterial({ map: asphalt, roughness: .91, metalness: .03 }),
      shoulder: new T.MeshStandardMaterial({ color: 0xa09888, roughness: 1 }),
      ground: new T.MeshStandardMaterial({ map: groundTexture, roughness: 1, vertexColors: true }),
      rail: new T.MeshStandardMaterial({ color: 0xc1c8c8, metalness: .78, roughness: .4 }),
      concrete: new T.MeshStandardMaterial({ color: 0xb8aea0, roughness: .93 }),
      dark: new T.MeshStandardMaterial({ color: 0x293640, roughness: .6, metalness: .5 }),
      white: new T.MeshStandardMaterial({ color: 0xe8e5cd, roughness: .75 }),
      center: new T.MeshStandardMaterial({ color: 0xe8e5cd, roughness: .75 }),
      bark: new T.MeshStandardMaterial({ color: 0x8c7960, roughness: 1 }),
      palm: new T.MeshStandardMaterial({ color: 0x667b42, roughness: .85, side: T.DoubleSide }),
      leaf: new T.MeshStandardMaterial({ color: 0x526947, roughness: 1 }),
      reflector: new T.MeshBasicMaterial({ color: 0xffb344 })
    };
    const boxGeometry = new T.BoxGeometry(1, 1, 1);
    const temp = new T.Object3D();
    function instanced(group, geometry, material, items, shadow = false) {
      const mesh = new T.InstancedMesh(geometry, material, items.length);
      items.forEach((a, i) => {
        temp.position.set(a[0], a[1], a[2]);temp.scale.set(a[3], a[4], a[5]);
        temp.rotation.set(a[6] || 0, a[7] || 0, a[8] || 0);temp.updateMatrix();
        mesh.setMatrixAt(i, temp.matrix);
      });
      mesh.castShadow = shadow;mesh.receiveShadow = true;
      // r147 does not cull individual instances. The parent segment is hidden as a unit.
      mesh.frustumCulled = false;group.add(mesh);return mesh;
    }
    function box(group, material, x, y, z, sx, sy, sz, cast = false) {
      const m = new T.Mesh(boxGeometry, material);m.position.set(x, y, z);m.scale.set(sx, sy, sz);
      m.castShadow = cast;m.receiveShadow = true;group.add(m);return m;
    }
    function label(lines) {
      return texture(512, 256, ctx => {
        ctx.fillStyle = '#235d58';ctx.fillRect(0, 0, 512, 256);
        ctx.strokeStyle = '#e7eedb';ctx.lineWidth = 5;ctx.strokeRect(10, 10, 492, 236);
        ctx.fillStyle = '#e7eedb';ctx.textAlign = 'center';ctx.font = '600 43px sans-serif';
        ctx.fillText(lines[0], 256, 84);ctx.font = '500 28px sans-serif';ctx.fillText(lines[1], 256, 136);
        ctx.font = '48px sans-serif';ctx.fillText('↓          ↓', 256, 211);
      });
    }
    const signMaterials = ['COAST ROAD', 'EAST BAY', 'PALM COAST'].map((s, i) => new T.MeshStandardMaterial({ map: label([s, i === 1 ? 'Scenic route · 02' : 'Stay in your lane']), roughness: .6 }));
    const treeGeometry = new T.IcosahedronGeometry(1, 1);
    const trunkGeometry = new T.CylinderGeometry(.65, 1, 1, 7);
    // Curved palm fronds, shared by every palm; silhouette reads well at a distance.
    const frondPositions = [], frondIndices = [];
    for (let f = 0; f < 8; f++) {
      const angle = f * Math.PI / 4, base = frondPositions.length / 3;
      for (let i = 0; i <= 8; i++) {
        const t = i / 8, r = t * 4.4, y = Math.sin(t * Math.PI) * 1.2 - t * 1.5, width = Math.sin(t * Math.PI) * .45;
        for (const side of [-1, 1]) frondPositions.push(Math.cos(angle) * r + Math.sin(angle) * width * side, y, Math.sin(angle) * r - Math.cos(angle) * width * side);
        if (i < 8) { const n = base + i * 2;frondIndices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
      }
    }
    const frondGeometry = new T.BufferGeometry();frondGeometry.setAttribute('position', new T.Float32BufferAttribute(frondPositions, 3));frondGeometry.setIndex(frondIndices);frondGeometry.computeVertexNormals();
    const segments = [];
    for (let n = 0; n < segmentCount; n++) {
      const g = new T.Group();
      box(g, materials.asphalt, 0, -.11, 0, roadWidth + .4, .2, segmentLength);
      box(g, materials.shoulder, 0, -.15, 0, roadWidth + 3.8, .14, segmentLength);
      // Seamless roadside terrain: periodic z component keeps neighbouring tile edges aligned.
      const terrain = new T.PlaneGeometry(270, segmentLength, 30, 14);terrain.rotateX(-Math.PI / 2);
      const pos = terrain.attributes.position, colors = [];
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + 110, z = pos.getZ(i);
        const edge = Math.max(0, x - 14);
        const h = x < -15 ? -2.3 : -.5 + Math.pow(edge / 30, 1.15) * (3.5 + 1.5 * Math.cos(z * Math.PI * 2 / segmentLength)) + Math.sin(edge * .15) * Math.min(2.8, edge * .13);
        pos.setX(i, x);pos.setY(i, h);
        const c = new T.Color().setRGB(.73 + random() * .08, .72 + random() * .05, .56 + random() * .06);
        colors.push(c.r, c.g, c.b);
      }
      terrain.setAttribute('color', new T.Float32BufferAttribute(colors, 3));terrain.computeVertexNormals();
      const land = new T.Mesh(terrain, materials.ground);land.receiveShadow = true;g.add(land);
      const dashes = [], center = [], posts = [], reflectors = [], stripes = [];
      for (let z = -segmentLength / 2; z < segmentLength / 2; z += 10) {
        for (let l = 1; l < lanes; l++) (l === 2 ? center : dashes).push([-roadWidth / 2 + laneWidth * l, .014, z + 2.4, .15, .012, 4.8]);
      }
      instanced(g, boxGeometry, materials.white, dashes);
      instanced(g, boxGeometry, materials.center, center);
      for (const side of [-1, 1]) {
        const x = side * (roadWidth / 2 + 1.65);
        box(g, materials.white, side * (roadWidth / 2 - .18), .015, 0, .16, .015, segmentLength);
        box(g, materials.rail, x, .74, 0, .13, .28, segmentLength, true);
        box(g, materials.rail, x, 1.0, 0, .16, .05, segmentLength);
        box(g, materials.concrete, side * (roadWidth / 2 + 1.35), -.01, 0, .35, .12, segmentLength);
        for (let z = -segmentLength / 2; z < segmentLength / 2; z += 5) posts.push([x, .45, z, .15, .9, .15]);
        for (let z = -segmentLength / 2; z < segmentLength / 2; z += 10) reflectors.push([x - side * .09, .82, z + 1, .025, .1, .24]);
        for (let z = -segmentLength / 2; z < segmentLength / 2; z += 2) stripes.push([side * (roadWidth / 2 + .35), .005, z, .5, .018, .13]);
      }
      instanced(g, boxGeometry, materials.rail, posts, true);
      instanced(g, boxGeometry, materials.reflector, reflectors);
      instanced(g, boxGeometry, materials.concrete, stripes);
      const trunks = [], leaves = [], palmTrunks = [], palms = [];
      for (let t = 0; t < 7; t++) {
        const z = -45 + random() * 90, x = 14 + random() * 11, h = 4 + random() * 3;
        const base = -.5 + Math.pow(Math.max(0, x - 14) / 30, 1.15) * (3.5 + 1.5 * Math.cos(z * Math.PI * 2 / segmentLength)) + Math.sin((x - 14) * .15) * Math.min(2.8, (x - 14) * .13);
        trunks.push([x, base + h * .38, z, .3, h * .76, .3]);
        leaves.push([x, base + h, z, 2.2, 2.8, 2.1, 0, random() * 6, 0]);
        leaves.push([x + .8, base + h - 1, z + .6, 1.8, 2.3, 1.8]);
      }
      for (let t = 0; t < 3; t++) {
        const z = -40 + t * 33, h = 7.2 + random() * 2, x = -11.5 - random() * 2;
        palmTrunks.push([x, h / 2 - .5, z, .22, h, .22, 0, 0, -.035]);
        palms.push([x + h * .0175, h - .5, z, .85, .85, .85, 0, random() * 6, 0]);
      }
      instanced(g, trunkGeometry, materials.bark, trunks, true);instanced(g, treeGeometry, materials.leaf, leaves, true);
      instanced(g, trunkGeometry, materials.bark, palmTrunks, true);instanced(g, frondGeometry, materials.palm, palms, true);
      if (n % 3 === 1) {
        box(g, materials.rail, -8.5, 3.4, 0, .24, 7, .24, true);box(g, materials.rail, 8.5, 3.4, 0, .24, 7, .24, true);
        box(g, materials.rail, 0, 6.7, 0, 17, .26, .32, true);
        const sign = new T.Mesh(new T.PlaneGeometry(6, 3), signMaterials[Math.floor(n / 3) % 3]);
        sign.position.set(0, 5.9, .19);g.add(sign);
      }
      g.position.z = -n * segmentLength;scene.add(g);segments.push(g);
    }

    const oceanMaterial = new T.MeshStandardMaterial({ color: 0x427b82, metalness: .45, roughness: .28, envMapIntensity: 1.35 });
    const ocean = new T.Mesh(new T.PlaneGeometry(1800, 2600), oceanMaterial);
    ocean.rotation.x = -Math.PI / 2;ocean.position.set(-916, -2.4, -600);scene.add(ocean);
    const waves = texture(256, 256, ctx => {
      ctx.fillStyle = '#808080';ctx.fillRect(0, 0, 256, 256);
      for (let i = 0; i < 110; i++) {
        ctx.strokeStyle = `rgba(230,230,230,${.05 + random() * .25})`;ctx.lineWidth = random() * 1.5 + .5;
        const y = random() * 256;ctx.beginPath();ctx.moveTo(0, y);ctx.bezierCurveTo(80, y - 3, 170, y + 5, 256, y);ctx.stroke();
      }
    });
    waves.encoding = T.LinearEncoding;waves.wrapS = waves.wrapT = T.RepeatWrapping;waves.repeat.set(70, 180);
    oceanMaterial.bumpMap = waves;oceanMaterial.bumpScale = .17;
    const mountains = new T.Group();scene.add(mountains);
    for (let layer = 0; layer < 3; layer++) {
      const vertices = [], indices = [];
      for (let i = 0; i <= 160; i++) {
        const x = -700 + i * 8.75;
        const envelope = Math.pow(Math.max(0, Math.sin(i / 160 * Math.PI)), .65);
        const y = -3 + envelope * (14 + Math.pow(Math.sin(i * .11 + layer) * .5 + .5, 2) * 66 + Math.sin(i * .29) * 7);
        vertices.push(x, -8, 0, x, y, 0);
        if (i < 160) { const j = i * 2;indices.push(j, j + 2, j + 1, j + 1, j + 2, j + 3); }
      }
      const geo = new T.BufferGeometry();geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));geo.setIndex(indices);geo.computeVertexNormals();
      const mountain = new T.Mesh(geo, new T.MeshBasicMaterial({ color: [0xb1a29e, 0x90969a, 0x737f89][layer], fog: false }));
      mountain.position.set(layer * 60, 0, -1000 + layer * 160);mountains.add(mountain);
    }

    // Merge static car parts by material to keep traffic draw calls low.
    function merge(geometries) {
      const positions = [], normals = [], uvs = [];
      for (const { geometry, matrix } of geometries) {
        const g = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(matrix);
        positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);
        if (g.attributes.uv) uvs.push(...g.attributes.uv.array);
        else for (let i = 0; i < g.attributes.position.count; i++) uvs.push(0, 0);
        g.dispose();
      }
      const g = new T.BufferGeometry();g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(normals, 3));g.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));return g;
    }
    function loft(sections) {
      const positions = [], indices = [];
      sections.forEach(([z, width, bottom, top]) => {
        const bevel = Math.min(.13, (top - bottom) * .35);
        const ring = [[-width * .86, bottom], [-width, bottom + bevel], [-width, top - bevel], [-width * .8, top], [0, top + .025], [width * .8, top], [width, top - bevel], [width, bottom + bevel], [width * .86, bottom], [0, bottom]];
        ring.forEach(([x, y]) => positions.push(x, y, z));
      });
      for (let s = 0; s < sections.length - 1; s++) for (let i = 0; i < 10; i++) {
        const a = s * 10 + i, b = s * 10 + (i + 1) % 10;indices.push(a, b, a + 10, b, b + 10, a + 10);
      }
      for (let i = 1; i < 9; i++) { indices.push(0, i + 1, i);const e = (sections.length - 1) * 10;indices.push(e, e + i, e + i + 1); }
      for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
      const g = new T.BufferGeometry();g.setAttribute('position', new T.Float32BufferAttribute(positions, 3));g.setIndex(indices);g.computeVertexNormals();return g;
    }
    const bodyGeo = loft([[-2.13, .76, .35, .65], [-1.76, .94, .34, .79], [-1.25, .98, .35, .84], [-.65, .94, .34, .81], [.5, .94, .34, .81], [1.3, 1, .35, .89], [1.85, .95, .36, .83], [2.12, .84, .4, .71]]);
    const glassGeo = loft([[-1.0, .76, .79, .87], [-.43, .67, .84, 1.35], [.45, .67, .84, 1.4], [1.23, .78, .83, .93]]);
    const roofGeo = loft([[-.45, .62, 1.31, 1.37], [-.25, .65, 1.35, 1.43], [.45, .65, 1.36, 1.43], [.62, .62, 1.25, 1.36]]);
    const carDark = new T.MeshStandardMaterial({ color: 0x101820, roughness: .48, metalness: .3 });
    const carChrome = new T.MeshStandardMaterial({ color: 0xc5cdd5, metalness: .94, roughness: .24 });
    const glass = new T.MeshPhysicalMaterial({ color: 0x203748, roughness: .08, metalness: .55, clearcoat: 1, envMapIntensity: 1.6 });
    const rubber = new T.MeshStandardMaterial({ color: 0x111319, roughness: .88 });
    const headlight = new T.MeshStandardMaterial({ color: 0xc8f2ff, emissive: 0xb9edff, emissiveIntensity: 2.3, roughness: .25 });
    const licenseMaterial = new T.MeshStandardMaterial({ map: texture(128, 64, ctx => {
      ctx.fillStyle = '#e1e8e5';ctx.fillRect(0, 0, 128, 64);ctx.fillStyle = '#263444';ctx.font = 'bold 34px sans-serif';ctx.textAlign = 'center';ctx.fillText('RUSH', 64, 44);
    }), roughness: .6 });
    const tireGeo = new T.CylinderGeometry(.37, .37, .25, 20);
    const discGeo = new T.CylinderGeometry(.265, .265, .26, 20);
    const rimGeo = new T.TorusGeometry(.265, .027, 6, 20);
    const cars = [];
    function makeCar(color, hero = false) {
      const g = new T.Group(), buckets = new Map();
      const paint = new T.MeshPhysicalMaterial({ color, metalness: .63, roughness: .27, clearcoat: 1, clearcoatRoughness: .13, envMapIntensity: 1.1 });
      const tail = new T.MeshStandardMaterial({ color: 0xff2441, emissive: 0xff0820, emissiveIntensity: 1.2, roughness: .25 });
      function part(geometry, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) {
        temp.position.set(x, y, z);temp.scale.set(sx, sy, sz);temp.rotation.set(rx, ry, rz);temp.updateMatrix();
        if (!buckets.has(material)) buckets.set(material, []);
        buckets.get(material).push({ geometry, matrix: temp.matrix.clone() });
      }
      part(bodyGeo, paint);part(glassGeo, glass);part(roofGeo, paint);
      part(boxGeometry, carDark, 0, .31, 0, 1.8, .12, 3.6);
      part(boxGeometry, carDark, 0, .47, 2.09, 1.5, .2, .13);
      part(boxGeometry, carDark, 0, .48, -2.05, 1.35, .18, .15);
      part(boxGeometry, carDark, 0, .66, 2.12, 1.68, .12, .035);
      // Hood crease, window pillars, mirror housings, side skirts and door handles.
      for (const side of [-1, 1]) {
        part(boxGeometry, paint, side * .72, 1.07, -.65, .048, .66, .055, .74);
        part(boxGeometry, paint, side * .74, 1.1, .9, .05, .57, .08, -.9);
        part(boxGeometry, carDark, side * .91, .38, .05, .11, .12, 2.35);
        part(boxGeometry, paint, side * 1.01, 1.02, -.55, .23, .12, .24, 0, side * -.2);
        part(boxGeometry, carChrome, side * .957, .77, .45, .028, .035, .23);
        part(boxGeometry, headlight, side * .53, .665, -2.105, .47, .065, .035, 0, side * .1);
        part(boxGeometry, tail, side * .55, .69, 2.15, .48, .06, .035);
        part(boxGeometry, tail, side * .77, .65, 2.135, .04, .13, .035);
        part(boxGeometry, carChrome, side * .62, .405, 2.16, .24, .11, .16);
      }
      if (hero) {
        part(boxGeometry, carDark, 0, 1.0, 1.91, 1.75, .065, .3);
        for (const x of [-.6, .6]) part(boxGeometry, carDark, x, .91, 1.88, .045, .2, .1);
      }
      for (const [material, parts] of buckets) {const mesh = new T.Mesh(merge(parts), material);mesh.castShadow = true;mesh.receiveShadow = true;g.add(mesh);}
      const plate = new T.Mesh(new T.PlaneGeometry(.48, .2), licenseMaterial);plate.position.set(0, .52, 2.165);g.add(plate);
      const wheels = [];
      for (const x of [-.92, .92]) for (const z of [-1.38, 1.37]) {
        const w = new T.Group();w.position.set(x, .37, z);g.add(w);wheels.push(w);
        const tire = new T.Mesh(tireGeo, rubber);tire.rotation.z = Math.PI / 2;tire.castShadow = true;w.add(tire);
        const hub = new T.Mesh(discGeo, carDark);hub.rotation.z = Math.PI / 2;w.add(hub);
        const parts = [];
        temp.position.set(Math.sign(x) * .138, 0, 0);temp.rotation.set(0, Math.PI / 2, 0);temp.scale.set(1, 1, 1);temp.updateMatrix();parts.push({ geometry: rimGeo, matrix: temp.matrix.clone() });
        for (let j = 0; j < 5; j++) {
          temp.position.set(Math.sign(x) * .14, 0, 0);temp.rotation.set(j * Math.PI / 5, 0, 0);temp.scale.set(.035, .47, .035);temp.updateMatrix();parts.push({ geometry: boxGeometry, matrix: temp.matrix.clone() });
        }
        w.add(new T.Mesh(merge(parts), carChrome));
      }
      const shadow = new T.Mesh(new T.PlaneGeometry(3.5, 6.2), new T.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: .7 }));
      shadow.rotation.x = -Math.PI / 2;shadow.position.y = .024;g.add(shadow);
      g.userData = { paint, tail, wheels, hero };cars.push(g);return g;
    }

    let quality = 'auto', adaptive = false, slowFrames = 0, frameCount = 0, totalMs = 0;
    let lastCameraZ = null, chaseX = 0;
    function setQuality(value) {
      quality = ['auto', 'high', 'smooth'].includes(value) ? value : 'auto';adaptive = false;slowFrames = frameCount = totalMs = 0;
      const smooth = quality === 'smooth';
      renderer.setPixelRatio(Math.min(devicePixelRatio || 1, smooth ? 1 : quality === 'high' ? 2 : mobile ? 1.35 : 1.75));
      renderer.shadowMap.enabled = !smooth && (!mobile || quality === 'high');
      renderer.setSize(innerWidth, innerHeight);
      return quality;
    }
    function resize() { renderer.setSize(innerWidth, innerHeight);camera.aspect = innerWidth / innerHeight;camera.updateProjectionMatrix(); }
    setQuality('auto');resize();
    function recycleSegments(playerZ) {
      for (const s of segments) {
        while (s.position.z - playerZ > segmentLength) s.position.z -= segmentCount * segmentLength;
        s.visible = s.position.z - playerZ < 520 && s.position.z - playerZ > -660;
      }
    }
    function update({ px, pz, speed, steer, brake, time, dt, running, started, shake }) {
      const hero = cars.find(c => c.userData.hero);
      if (!hero) return;
      hero.position.set(px, 0, pz);
      hero.rotation.z = T.MathUtils.lerp(hero.rotation.z, -steer * .045, Math.min(1, dt * 7));
      hero.rotation.y = T.MathUtils.lerp(hero.rotation.y, -steer * .045, Math.min(1, dt * 7));
      hero.userData.tail.emissiveIntensity = brake && running ? 4 : 1.2;
      cars.forEach(c => {if(c.visible && running)c.userData.wheels.forEach(w => w.rotation.x -= speed * dt / .37);});
      if (lastCameraZ === null || Math.abs(pz - lastCameraZ) > 40) chaseX = px;
      lastCameraZ = pz;chaseX = T.MathUtils.lerp(chaseX, px, Math.min(1, dt * 5));
      if (started) {
        const fov = 58 + Math.max(0, speed - 28) / 39 * 9;
        camera.fov = T.MathUtils.lerp(camera.fov, fov, Math.min(1, dt * 3));camera.updateProjectionMatrix();
        const bob = reduceMotion ? 0 : Math.sin(time * 21) * .008 * speed / 67;
        camera.position.set(chaseX * .86 + (Math.random() - .5) * shake, 2.85 + bob + shake * .2, pz + 7.5);
        camera.lookAt(px * .65, .7, pz - 20);
      } else {
        const orbit = reduceMotion ? .3 : Math.sin(time * .14) * .18 + .3;
        camera.fov = innerWidth < 600 ? 57 : 48;camera.updateProjectionMatrix();
        if(innerWidth < 600){
          camera.position.set(px + 6.6 + orbit, 2.9, pz + 8.5);
          camera.lookAt(px, .25, pz);
        }else{
          camera.position.set(px + 5.4 + orbit, 2.3, pz + 6.3);
          camera.lookAt(px - (innerWidth > 800 ? 1.8 : .4), .65, pz - 1.5);
        }
      }
      skyDome.position.copy(camera.position);ocean.position.z = pz - 600;mountains.position.z = pz;
      waves.offset.y = time * .005;
      sun.position.copy(sunDirection).multiplyScalar(80).add(new T.Vector3(px, 0, pz - 12));
      sun.target.position.set(px, 0, pz - 12);
      if (quality === 'auto' && !adaptive && running && dt > 0) {
        frameCount++;totalMs += dt * 1000;
        if (frameCount >= 150) {
          if (totalMs / frameCount > 28) slowFrames++;
          else slowFrames = 0;
          if (slowFrames >= 2) {
            renderer.setPixelRatio(1);renderer.shadowMap.enabled = false;adaptive = true;
            const label = document.getElementById('quality-status');if(label)label.textContent = 'Auto · smoother play';
          }
          frameCount = totalMs = 0;
        }
      }
    }
    return { renderer, scene, camera, skyDome, segments, makeCar, recycleSegments, update, resize, setQuality,
      setMode(mode) { materials.center.color.set(mode === 'two' ? 0xffd86d : 0xe8e5cd); } };
  }
  window.HighwayScene = { create };
})();
