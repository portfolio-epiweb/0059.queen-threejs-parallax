import * as THREE from 'three'

import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js'
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js'

import Lenis from '../vendor/lenis/dist/lenis.mjs'

const devMode = false

const lenis = new Lenis()
function raf(time) {
	lenis.raf(time)

	const scroll = lenis.scroll
	const header = document.getElementById('mainHeader')
	if (header) {
		const speed = -0.45
		const yPos = -(scroll * speed)
		header.style.transform = `translateY(${yPos}px)`
	}

	requestAnimationFrame(raf)
}
requestAnimationFrame(raf)

const config = {
	lighting: {
		ambientIntensity: 0.55,
	},
	camera: {
		fov: 60,
		near: 0.1,
		far: 8,
	},
}

const scene = new THREE.Scene()
const loader = new GLTFLoader()

const processModel = (gltf) => {
	gltf.scene.traverse((child) => {
		if (child.isMesh) {
			child.material = new THREE.MeshStandardMaterial({
				map: child.material.map,
				color: child.material.color,
				transparent: child.material.transparent,
				opacity: child.material.opacity,
				alphaMap: child.material.alphaMap,
				roughness: 1,
				metalness: 0,
			})
			child.castShadow = true
			child.receiveShadow = true
		}
	})
	scene.add(gltf.scene)
	hidePreloader()
}

const customPreloader = document.getElementById('preloader')

function hidePreloader() {
	if (!customPreloader) return
	let opacity = 1
	const fadeInterval = setInterval(() => {
		opacity -= 0.05
		customPreloader.style.opacity = opacity
		if (opacity <= 0) {
			clearInterval(fadeInterval)
			customPreloader.style.display = 'none'
		}
	}, 30)
}

loader.load(
	'models/scene.glb',
	processModel,
	(progress) => {
		customPreloader.textContent = `Loading: ${Math.round((progress.loaded / progress.total) * 100)}%`
	},
	(error) => {
		console.error('Error loading model:', error)
	}
)

scene.add(new THREE.AmbientLight('#fff', config.lighting.ambientIntensity))

const pointLightFire = new THREE.PointLight('orange', 2.75)
pointLightFire.position.set(-0.75, 0.75, -0.1)

const pointLightSide = new THREE.PointLight('red', 0.25)
pointLightSide.position.set(0.1, 0.4, -0.35)

const pointLightSide2 = new THREE.PointLight('white', 0.4)
pointLightSide2.position.set(-0.15, 0.4, -0.35)

scene.add(pointLightFire, pointLightSide, pointLightSide2)

const fogColor = '#181818'
scene.background = new THREE.Color(fogColor)
scene.fog = new THREE.Fog(fogColor, 1, 5.75)

const camera = new THREE.PerspectiveCamera(config.camera.fov, window.innerWidth / window.innerHeight, config.camera.near, config.camera.far)

const renderer = new THREE.WebGLRenderer({
	powerPreference: 'high-performance',
})
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.55
renderer.physicallyCorrectLights = true
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.setSize(window.innerWidth, window.innerHeight)

const header = document.getElementById('mainHeader')
header.appendChild(renderer.domElement)

const composer = new EffectComposer(renderer)

const renderPass = new RenderPass(scene, camera)
composer.addPass(renderPass)

const vignetteShader = VignetteShader
const vignettePass = new ShaderPass(vignetteShader)
vignettePass.uniforms['offset'].value = 1
vignettePass.uniforms['darkness'].value = 1.009
composer.addPass(vignettePass)

const fxaaPass = new ShaderPass(FXAAShader)
fxaaPass.material.uniforms['resolution'].value.set(1 / (window.innerWidth * renderer.getPixelRatio()), 1 / (window.innerHeight * renderer.getPixelRatio()))
composer.addPass(fxaaPass)

const outputPass = new OutputPass()
composer.addPass(outputPass)

const mouse = { x: 0, y: 0 }
const targetCamera = {
	x: 0,
	y: 0,
	z: 0,
	offsetX: -3.15,
	offsetY: -2,
	offsetZ: 0.1,
}

const initialScrollYValue = 2
const initialScrollXZValue = 5

let scrollYvalue = initialScrollYValue
let scrollXZvalue = initialScrollXZValue

window.addEventListener('scroll', () => {
	const scrollYPosition = window.scrollY / window.innerHeight
	scrollYvalue = initialScrollYValue - Math.min(scrollYPosition, 0.5)
	scrollXZvalue = initialScrollXZValue - Math.min(scrollYPosition, 2)

	const scrollProgress = Math.min(scrollYPosition, 1)
	const blurValue = Math.min(scrollProgress * 10, 10)
	const opacityValue = 1 - Math.min(scrollProgress, 1)

	document.documentElement.style.setProperty('--scroll-blur', `${blurValue}px`)
	document.documentElement.style.setProperty('--scroll-opacity', opacityValue)
})

const animate = () => {
	requestAnimationFrame(animate)

	targetCamera.x = targetCamera.offsetX + scrollXZvalue * Math.cos(mouse.x * Math.PI * 0.035)
	targetCamera.y = targetCamera.offsetY + scrollYvalue + mouse.y * 0.15
	targetCamera.z = targetCamera.offsetZ + scrollXZvalue * Math.sin(mouse.x * Math.PI * 0.035)

	camera.position.lerp(new THREE.Vector3(targetCamera.x, targetCamera.y, targetCamera.z), 0.05)

	camera.lookAt(0, 0, 0)
	composer.render()
}
animate()

document.addEventListener('mousemove', (e) => {
	mouse.x = (e.clientX / window.innerWidth) * 2 - 1
	mouse.y = -(e.clientY / window.innerHeight) * 2 + 1
})

window.addEventListener('resize', () => {
	camera.aspect = window.innerWidth / window.innerHeight
	camera.updateProjectionMatrix()

	renderer.setSize(window.innerWidth, window.innerHeight)
	composer.setSize(window.innerWidth, window.innerHeight)
})

if (devMode) {
	const pointLightHelper = new THREE.PointLightHelper(pointLightFire, 0.1)
	const pointLightSideHelper = new THREE.PointLightHelper(pointLightSide, 0.1)
	const pointLightSide2Helper = new THREE.PointLightHelper(pointLightSide2, 0.1)

	scene.add(pointLightHelper, pointLightSideHelper, pointLightSide2Helper)
}
