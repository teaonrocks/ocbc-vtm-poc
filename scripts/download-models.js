import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import https from 'https'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const MODELS_DIR = path.join(__dirname, '../public/models')
// Using jsdelivr CDN for face-api models
const BASE_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model'

const models = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2',
]

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https
      .get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          return downloadFile(response.headers.location, dest)
            .then(resolve)
            .catch(reject)
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: ${response.statusCode}`))
          return
        }
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      })
      .on('error', (err) => {
        fs.unlink(dest, () => {})
        reject(err)
      })
  })
}

async function downloadModels() {
  // Ensure models directory exists
  if (!fs.existsSync(MODELS_DIR)) {
    fs.mkdirSync(MODELS_DIR, { recursive: true })
  }

  console.log('Downloading face-api models...')
  console.log(`Target directory: ${MODELS_DIR}`)

  for (const model of models) {
    const url = `${BASE_URL}/${model}`
    const dest = path.join(MODELS_DIR, model)

    // Skip if already exists
    if (fs.existsSync(dest)) {
      console.log(`✓ ${model} already exists, skipping...`)
      continue
    }

    try {
      console.log(`Downloading ${model}...`)
      await downloadFile(url, dest)
      console.log(`✓ Downloaded ${model}`)
    } catch (error) {
      console.error(`✗ Failed to download ${model}:`, error.message)
    }
  }

  console.log('\nModel download complete!')
}

downloadModels().catch(console.error)
