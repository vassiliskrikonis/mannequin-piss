var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera( 75, window.innerWidth/window.innerHeight, 0.1, 1000 );
var renderer = new THREE.WebGLRenderer();
var clock = new THREE.Clock();
var container = new THREE.Object3D();


var forces = [
	new THREE.Vector3(0, -10, 0), // gravity
	new THREE.Vector3(0, 0, 0) // wind
];
var particleEmitter;
var MAX_PARTICLES = 4000;
var particleCount = 0;
var ground;
var boundaries = [
	{ E: function(x,y,z) { return (y+160); }, normal: new THREE.Vector3(0,1,0) }, // ground
	{ E: function(x,y,z) { return (-x + 60); }, normal: new THREE.Vector3(-1,0,0) }, // right wall
	{ E: function(x,y,z) { return (x + 60); }, normal: new THREE.Vector3(1,0,0) }, // left wall
	{ E: function(x,y,z) { return (z + 60); }, normal: new THREE.Vector3(0,0,1) } // back wall
];

var options = {
	boy: {
		scale: 0.74,
		x: -4,
		y: 21,
		z: -8,
		rotationX: 0.01,
		rotationY: -0.65,
		rotationZ: 0.01
	},
	particle: {
		x: -11,
		y: -86,
		z: 28,
		velocityX: 2,
		velocityY: 6,
		velocityZ: 4
	},
	camera: {
		x: 0,
		y: -20,
		z: 51
	}
};

function setup() {
  renderer.setSize( window.innerWidth, window.innerHeight );
	renderer.setClearColor( 0x00ffc5 );
	document.body.appendChild( renderer.domElement );
  camera.position.z = 170;
  camera.position.y = -80;
  scene.add(container);

  var loader = new THREE.STLLoader();
	loader.load('PeeBoyOK5k.stl', function(geometry) {
    console.log('loaded stl');
		var material = new THREE.MeshNormalMaterial();
		boy = new THREE.Mesh(geometry, material);
		boy.position.set(options.boy.x, options.boy.y, options.boy.z);
		boy.scale.x = options.boy.scale;
		boy.scale.y = options.boy.scale;
		boy.scale.z = options.boy.scale;
		container.add(boy);

    // init particles
    var geometry = new THREE.Geometry();
  	initParticles(geometry.vertices);
  	var material = new THREE.PointsMaterial({color: 'yellow'});
  	particleEmitter = new THREE.Points(geometry, material);
    particleEmitter.position.set(27, -3, 0);
  	container.add(particleEmitter);

    // start rendering cycle
    render();
	});
}
setup();

function render() {
  var dt = clock.getDelta();
  var particles = getParticles(particleEmitter.geometry.vertices, dt);
	computeForces(particles);
	updateState(particles, dt);
	particleEmitter.geometry.verticesNeedUpdate = true;

  requestAnimationFrame( render );
	renderer.render(scene, camera);
  container.rotateY(0.01);
}

function initParticles(vertices) {
	for ( var i=0; i< MAX_PARTICLES; i++) {
		var vertex = new THREE.Vector3();
		initVertex(vertex);
		vertices.push(vertex);
	}
}

function initVertex(vertex) {
	vertex.set(options.particle.x, options.particle.y, options.particle.z); // initial position
	//vertex.v = new THREE.Vector3(getRandomArbitrary(-5,5), getRandomArbitrary(20, 25), getRandomArbitrary(-5,5));
	var offsetX = getRandomArbitrary(-0.7, 0.7);
	var offsetY = getRandomArbitrary(-2, 2);
	var offsetZ = getRandomArbitrary(-0.3, 0.3);
	vertex.v = new THREE.Vector3(options.particle.velocityX + offsetX, options.particle.velocityY + offsetY, options.particle.velocityZ + offsetZ);
	vertex.f = new THREE.Vector3(0,0,0);
	vertex.m = 1;
	vertex.life = 10;
}

function getParticles(vertices, delta) {
	var fetchedParticles = [];
	var emissionRate = 5;
	particleCount = Math.min(particleCount+emissionRate, MAX_PARTICLES);
	for (var i=0; i<particleCount; i++) {
		fetchedParticles.push(vertices[i]);
	}
	return fetchedParticles;
}

function computeForces(vertices) {
	for(var i=0; i < vertices.length; i++) {
		var vertex = vertices[i];
		vertex.f.set(0,0,0); // zero-out force vector;

		for ( var j=0; j < forces.length; j++) {
			vertex.f.add(forces[j]);
		}
	}
}

function updateState(vertices, dt) {
	for (var i=0; i < vertices.length; i++) {
		var vertex = vertices[i];
		var f = vertex.f;
		var a = f.divideScalar(vertex.m);
		// vertex.addScaledVector(vertex.v, dt);
		// vertex.v.addScaledVector(a, dt);

		var p0 = vertex.clone();
		var v0 = vertex.v.clone();
		var v1 = v0.clone().addScaledVector(a, dt);
		var sumV = v0.clone().add(v1);
		vertex.addScaledVector(sumV, dt/2); // p' = p + (1/2)(v+v')Dt
		vertex.v.copy(v1);

		for(var j=0; j<boundaries.length; j++) {
			if(boundaries[j].E(vertex.x, vertex.y, vertex.z) < 0) {
				// vertex.v.y *= -1*0.4;
				// var pN = vertex.clone().multiply(boundaries[0].normal);
				// vertex.sub(pN);
				vertex.copy(p0);

				// v' = v - (1+k)vN
				// where vN := v_normal = N(v.N)
				var vN = boundaries[j].normal.clone().multiplyScalar(v0.dot(boundaries[j].normal));
				v1 = v0.clone().addScaledVector(vN, -(1+0.5));

				// add extra random vector on plane y=0 so that particles bounce "everywhere"
				// added: a bit of y values on the v2 vector to add randomness to the bounce
				var v2 = new THREE.Vector3(THREE.Math.randFloatSpread(20), THREE.Math.randFloatSpread(3), THREE.Math.randFloatSpread(20));
				v1.add(v2);

				vertex.v.copy(v1);
			}
		}

		vertex.life -= dt;
		if (vertex.life < 0) {
			try {
				initVertex(vertex);
				var temp = vertex;
				vertices[i] = vertices[particleCount];
				vertices[particleCount] = temp;
				particleCount--;
			}
			catch(err) {
				console.log(err);
			}
		}
	}
}

// Returns a random number between min (inclusive) and max (exclusive)
function getRandomArbitrary(min, max) {
  return Math.random() * (max - min) + min;
}
