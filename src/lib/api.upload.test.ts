import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ hold: false, uploads: [] as Array<{ resumed: boolean; starts: number; aborts: boolean[]; options: Record<string, any> }> }))

vi.mock('tus-js-client', () => {
	class MockUpload {
		url: string | null = null
		resumed = false
		starts = 0
		aborts: boolean[] = []
		constructor(public file: File, public options: Record<string, any>) { mocks.uploads.push(this) }
		async findPreviousUploads() { return [{ uploadUrl: 'previous' }] }
		resumeFromPreviousUpload() { this.resumed = true }
		start() {
			this.starts++
			if (mocks.hold) return
			queueMicrotask(() => {
				this.options.onProgress(this.file.size, this.file.size)
				this.url = `${this.options.endpoint}upload-${mocks.uploads.indexOf(this)}`
				void this.options.onSuccess()
			})
		}
		async abort(terminate = false) { this.aborts.push(terminate) }
	}
	return { Upload: MockUpload }
})

import { uploadProjectMedia } from './api'

describe('resumable project uploads', () => {
	beforeEach(() => {
		mocks.uploads.length = 0
		mocks.hold = false
		vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
			id: 'upload-0', state: 'ready', project_id: 'project-1', filename: 'clip.mp4',
			offset: 4, size: 4,
			media: { id: 'm1', name: 'clip.mp4', path: 'media/clip.mp4', kind: 'video', content_type: 'video/mp4', content_url: '/media/clip.mp4', bytes: 4, modified_at: new Date().toISOString() },
		}), { status: 200, headers: { 'Content-Type': 'application/json' } })))
	})

	it('resumes fingerprints and reports aggregate completion', async () => {
		const progress: number[] = []
		const file = new File(['clip'], 'clip.mp4', { type: 'video/mp4', lastModified: 42 })
		const task = uploadProjectMedia('project-1', [file], (event) => progress.push(event.sent))
		const media = await task.result
		expect(media[0].path).toBe('media/clip.mp4')
		expect(mocks.uploads[0].resumed).toBe(true)
		expect(mocks.uploads[0].options.chunkSize).toBe(32 * 1024 * 1024)
		expect(progress.at(-1)).toBe(file.size)
	})

	it('rejects files above the configured client limit before starting', async () => {
		const file = new File(['x'], 'huge.mp4')
		Object.defineProperty(file, 'size', { value: 65 * 1024 * 1024 * 1024 })
		await expect(uploadProjectMedia('project-1', [file]).result).rejects.toThrow('max is 64 GiB')
		expect(mocks.uploads).toHaveLength(0)
	})

	it('pauses, resumes, and terminates active uploads', async () => {
		mocks.hold = true
		const task = uploadProjectMedia('project-1', [new File(['clip'], 'clip.mp4')])
		await vi.waitFor(() => expect(mocks.uploads[0]?.starts).toBe(1))
		await task.pause()
		expect(mocks.uploads[0].aborts).toEqual([false])
		task.resume()
		expect(mocks.uploads[0].starts).toBe(2)
		await task.cancel()
		expect(mocks.uploads[0].aborts.at(-1)).toBe(true)
		await expect(task.result).rejects.toThrow('Upload cancelled')
	})
})
