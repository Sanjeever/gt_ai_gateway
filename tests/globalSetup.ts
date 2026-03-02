import { join } from 'path'
import { spawn, ChildProcess } from 'child_process'
import { existsSync, unlinkSync } from 'fs'
import config, { DB_CONFIG, SERVER_CONFIG, TEST_OPTIONS, logTest } from './config'
import { init as initDB, cleanup as cleanupDB } from './helpers/dbHelper'
import { startMockServer, stopMockServer } from './helpers/mockServer'

let testServerProcess: ChildProcess | null = null
let mockServerProcess: any | null = null

export async function setup(): Promise<void> {
    console.log('=== Test Environment Setup ===')
    console.log('[GLOBAL_SETUP] setup() called at', new Date().toISOString())

    cleanupTestDatabaseFile()
    console.log('[GLOBAL_SETUP] Database file deleted')

    console.log('Initializing test database...')
    await initDB()
    console.log('[GLOBAL_SETUP] Database initialized')

    if (config.useMockServer) {
        console.log('Starting mock AI server...')
        mockServerProcess = await startMockServer()
        console.log('[GLOBAL_SETUP] Mock AI server started')
    }

    await startTestServer()
    console.log('[GLOBAL_SETUP] Test server started')

    console.log('Test environment ready!')
}

export async function teardown(): Promise<void> {
    console.log('=== Test Environment Teardown ===')
    console.log('[GLOBAL_TEARDOWN] teardown() called at', new Date().toISOString())

    await stopTestServer()
    console.log('[GLOBAL_TEARDOWN] Test server stopped')

    if (mockServerProcess) {
        await stopMockServer(mockServerProcess)
        mockServerProcess = null
        console.log('[GLOBAL_TEARDOWN] Mock AI server stopped')
    }

    if (TEST_OPTIONS.cleanup) {
        console.log('Cleaning up test database...')
        await cleanupDB()
        cleanupTestDatabaseFile()
        console.log('[GLOBAL_TEARDOWN] Database cleaned up and file deleted')
    }

    console.log('Test environment teardown complete!')
}

function startTestServer(): Promise<void> {
    return new Promise((resolve, reject) => {
        const serverPath = join(process.cwd(), 'src', 'local.ts')
        const env = {
            ...process.env,
            PORT: SERVER_CONFIG.port.toString(),
            DB_PATH: DB_CONFIG.path,
        }

        console.log('Starting test server on port', SERVER_CONFIG.port)
        console.log('Database path:', DB_CONFIG.path)

        testServerProcess = spawn('npx', ['tsx', serverPath], {
            env,
            stdio: ['ignore', 'pipe', 'pipe'],
        })

        if (TEST_OPTIONS.verbose) {
            testServerProcess.stdout?.on('data', (data) => {
                console.log('[SERVER]', data.toString().trim())
            })
            testServerProcess.stderr?.on('data', (data) => {
                console.error('[SERVER ERROR]', data.toString().trim())
            })
        }

        testServerProcess.on('error', (err) => {
            reject(err)
        })

        setTimeout(resolve, 12000)
    })
}

function stopTestServer(): Promise<void> {
    return new Promise((resolve) => {
        if (testServerProcess) {
            console.log('Stopping test server...')
            testServerProcess.kill('SIGTERM')
            testServerProcess = null
        }
        resolve()
    })
}

function cleanupTestDatabaseFile(): void {
    if (existsSync(DB_CONFIG.path)) {
        console.log('Removing test database file:', DB_CONFIG.path)
        unlinkSync(DB_CONFIG.path)
    }
}
