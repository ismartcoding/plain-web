/**
 * WebGL2 renderer for screen mirroring — replaces Canvas 2D drawImage.
 *
 * Key optimizations:
 * - desynchronized: true — bypasses the browser compositor, writing directly
 *   to the screen, saving ~1 frame of display latency (~16ms @ 60fps).
 * - texImage2D(VideoFrame) — GPU-direct texture upload, 0 CPU copy.
 * - Minimal shader: fullscreen triangle + texture sample.
 *
 * Falls back to Canvas 2D if WebGL2 is unavailable.
 */

const VERT_SRC = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
  // Flip Y so the frame is upright (WebGL texture origin is bottom-left)
  v_uv = vec2(a_pos.x * 0.5 + 0.5, 0.5 - a_pos.y * 0.5);
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`

const FRAG_SRC = `#version 300 es
precision mediump float;
in vec2 v_uv;
uniform sampler2D u_tex;
out vec4 fragColor;
void main() {
  fragColor = texture(u_tex, v_uv);
}`

// Fullscreen quad as 2 triangles (6 vertices, clip-space coords)
const QUAD_VERTS = new Float32Array([
  -1, -1,
   1, -1,
  -1,  1,
  -1,  1,
   1, -1,
   1,  1,
])

export class MirrorGLRenderer {
  private gl: WebGL2RenderingContext | null = null
  private ctx2d: CanvasRenderingContext2D | null = null
  private program: WebGLProgram | null = null
  private texture: WebGLTexture | null = null
  private vao: WebGLVertexArrayObject | null = null
  private canvas: HTMLCanvasElement | null = null
  private useWebGL = false
  private resizeObserver: ResizeObserver | null = null

  get isWebGL(): boolean {
    return this.useWebGL
  }

  attach(canvas: HTMLCanvasElement): boolean {
    this.canvas = canvas
    // Try WebGL2 with desynchronized first — the key latency win
    try {
      const gl = canvas.getContext('webgl2', {
        alpha: false,
        desynchronized: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
        antialias: false,
        depth: false,
        stencil: false,
        premultipliedAlpha: false,
      })
      if (gl) {
        this.gl = gl
        if (this.initGL()) {
          this.useWebGL = true
          this.setupResizeObserver(canvas)
          console.log('[MirrorGL] WebGL2 renderer active (desynchronized=true)')
          return true
        }
        this.gl = null
      }
    } catch (e) {
      console.warn('[MirrorGL] WebGL2 init failed, falling back to Canvas 2D', e)
    }
    // Fallback to Canvas 2D
    this.ctx2d = canvas.getContext('2d', { alpha: false })
    this.setupResizeObserver(canvas)
    console.log('[MirrorGL] Canvas 2D fallback active')
    return this.ctx2d !== null
  }

  private initGL(): boolean {
    const gl = this.gl!
    const vs = this.compileShader(gl.VERTEX_SHADER, VERT_SRC)
    const fs = this.compileShader(gl.FRAGMENT_SHADER, FRAG_SRC)
    if (!vs || !fs) return false
    const program = gl.createProgram()
    if (!program) return false
    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('[MirrorGL] link failed:', gl.getProgramInfoLog(program))
      return false
    }
    this.program = program

    // VAO with fullscreen quad
    const vao = gl.createVertexArray()
    gl.bindVertexArray(vao)
    const vbo = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    gl.bufferData(gl.ARRAY_BUFFER, QUAD_VERTS, gl.STATIC_DRAW)
    const posLoc = gl.getAttribLocation(program, 'a_pos')
    gl.enableVertexAttribArray(posLoc)
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0)
    gl.bindVertexArray(null)
    this.vao = vao

    // Texture for VideoFrame upload
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return true
  }

  private compileShader(type: number, src: string): WebGLShader | null {
    const gl = this.gl!
    const shader = gl.createShader(type)
    if (!shader) return null
    gl.shaderSource(shader, src)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[MirrorGL] shader compile failed:', gl.getShaderInfoLog(shader))
      gl.deleteShader(shader)
      return null
    }
    return shader
  }

  private setupResizeObserver(canvas: HTMLCanvasElement) {
    this.resizeObserver = new ResizeObserver(() => this.fitCanvasToWrapper())
    const parent = canvas.parentElement
    if (parent) this.resizeObserver.observe(parent)
  }

  renderFrame(frame: VideoFrame) {
    if (!this.canvas) {
      frame.close()
      return
    }
    // Resize canvas backing store when frame dimensions change
    if (this.canvas.width !== frame.displayWidth || this.canvas.height !== frame.displayHeight) {
      this.canvas.width = frame.displayWidth
      this.canvas.height = frame.displayHeight
      this.fitCanvasToWrapper()
      if (this.useWebGL && this.gl) {
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
      }
    }
    if (this.useWebGL && this.gl && this.program && this.texture && this.vao) {
      const gl = this.gl
      gl.useProgram(this.program)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, this.texture)
      // VideoFrame → GPU texture: 0 CPU copy, browser handles YUV→RGB
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RGB,
        gl.RGB, gl.UNSIGNED_BYTE, frame,
      )
      gl.bindVertexArray(this.vao)
      gl.drawArrays(gl.TRIANGLES, 0, 6)
      gl.bindVertexArray(null)
    } else if (this.ctx2d) {
      this.ctx2d.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height)
    }
    frame.close()
  }

  private fitCanvasToWrapper() {
    if (!this.canvas || !this.canvas.parentElement) return
    const wrapper = this.canvas.parentElement
    const wrapperW = wrapper.clientWidth
    const wrapperH = wrapper.clientHeight
    if (wrapperW === 0 || wrapperH === 0 || this.canvas.width === 0 || this.canvas.height === 0) return
    const frameRatio = this.canvas.width / this.canvas.height
    const wrapperRatio = wrapperW / wrapperH
    if (frameRatio > wrapperRatio) {
      this.canvas.style.width = wrapperW + 'px'
      this.canvas.style.height = (wrapperW / frameRatio) + 'px'
    } else {
      this.canvas.style.height = wrapperH + 'px'
      this.canvas.style.width = (wrapperH * frameRatio) + 'px'
    }
  }

  clear() {
    if (this.useWebGL && this.gl && this.canvas) {
      this.gl.clearColor(0, 0, 0, 1)
      this.gl.clear(this.gl.COLOR_BUFFER_BIT)
    } else if (this.ctx2d && this.canvas) {
      this.ctx2d.fillStyle = '#000'
      this.ctx2d.fillRect(0, 0, this.canvas.width, this.canvas.height)
    }
  }

  close() {
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    if (this.gl) {
      if (this.texture) this.gl.deleteTexture(this.texture)
      if (this.vao) this.gl.deleteVertexArray(this.vao)
      if (this.program) this.gl.deleteProgram(this.program)
    }
    this.gl = null
    this.ctx2d = null
    this.program = null
    this.texture = null
    this.vao = null
    this.canvas = null
  }
}
