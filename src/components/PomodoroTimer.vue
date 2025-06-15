<template>
  <div class="quick-content-main">
    <div class="top-app-bar">
      <button v-tooltip="$t('close')" class="btn-icon" @click.prevent="store.quick = ''">
        <i-lucide:x />
      </button>
      <div class="title">
        {{ $t('pomodoro_timer') }}
        <!-- Warning icon for notification permissions -->
        <div v-if="settings.showNotification && hasNotificationWarning" class="warning-indicator">
          <popper>
            <button class="btn-icon warning-icon">
              <i-material-symbols:warning-outline />
            </button>
            <template #content>
              <div class="warning-dropdown">
                <div class="warning-content">
                  <i-material-symbols:error-outline-rounded />
                  <div class="warning-text">
                    {{ $t(notificationWarningMessage) }}
                  </div>
                </div>
                <div v-if="notificationWarningAction" class="warning-actions">
                  <v-filled-button class="btn-sm" @click="notificationWarningAction.action()">
                    {{ $t(notificationWarningAction.text) }}
                  </v-filled-button>
                </div>
              </div>
            </template>
          </popper>
        </div>
      </div>
    </div>

    <div class="quick-content-body">
      <div class="timer-container">
        <div class="status-display">
          <div class="current-phase">
            {{ getCurrentPhaseText() }}
          </div>
          <div class="round-info">
            {{ $t('round_n_of_n', { current: currentRound, total: settings.pomodorosBeforeLongBreak }) }}
          </div>
        </div>

        <!-- Circular timer -->
        <div class="timer-circle">
          <svg class="circle-progress" :class="{ adjustable: totalTime > 0 }" width="240" height="240" viewBox="0 0 240 240" @click="totalTime > 0 ? handleClick($event) : null">
            <circle cx="120" cy="120" r="110" fill="none" stroke="var(--md-sys-color-surface-variant)" stroke-width="8" />
            <circle
              cx="120"
              cy="120"
              r="110"
              fill="none"
              stroke="var(--md-sys-color-primary)"
              stroke-width="8"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="strokeDashoffset"
              transform="rotate(-90 120 120)"
              class="progress-ring"
            />
          </svg>
          <div class="timer-content">
            <div class="time-display">{{ formatTime(timeLeft) }}</div>
            <div class="time-label">{{ getCurrentPhaseText() }}</div>
            <div v-if="totalTime > 0" class="click-hint">{{ $t('click_to_adjust') }}</div>
          </div>
        </div>

        <!-- Control buttons -->
        <div class="timer-controls">
          <v-filled-button v-if="!isRunning && !isPaused" class="btn-start" @click="startTimer">
            {{ $t('start') }}
          </v-filled-button>

          <v-filled-button v-if="isRunning" class="btn-pause" @click="pauseTimer">
            {{ $t('pause') }}
          </v-filled-button>

          <v-filled-button v-if="isPaused" class="btn-resume" @click="resumeTimer">
            {{ $t('resume') }}
          </v-filled-button>

          <v-filled-button v-if="isRunning" class="btn-stop" @click="stopTimer">
            {{ $t('stop') }}
          </v-filled-button>
        </div>

        <!-- Daily stats -->
        <div class="daily-stats">
          <div class="stats-title">{{ $t('today_completed') }}</div>
          <div class="tomato-display">
            <span v-for="i in Math.max(completedToday, 4)" :key="i" class="tomato-icon" :class="{ completed: i <= completedToday }"> 🍅 </span>
          </div>
          <div class="stats-number">{{ $t('x_pomodoros', { count: completedToday }) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useMainStore } from '@/stores/main'
import { useI18n } from 'vue-i18n'
import toast from '@/components/toaster'
import type { PomodoroSettings } from '@/types/pomodoro'
import { playNotificationSound } from '@/utils/pomodoro'
import { initQuery } from '@/lib/api/query'
import { pomodoroTodayAndSettingsGQL } from '@/lib/api/query'
import { initMutation } from '@/lib/api/mutation'
import { startPomodoroGQL, stopPomodoroGQL, pausePomodoroGQL, updatePomodoroProgressGQL } from '@/lib/api/mutation'
import emitter from '@/plugins/eventbus'
import { useTempStore } from '@/stores/temp'
import { storeToRefs } from 'pinia'
import { useNotificationWarning } from '@/hooks/notification-warning'

const store = useMainStore()
const { t } = useI18n()

// === GraphQL Mutations ===
const { mutate: startPomodoroMutation } = initMutation({ document: startPomodoroGQL })
const { mutate: stopPomodoroMutation } = initMutation({ document: stopPomodoroGQL })
const { mutate: pausePomodoroMutation } = initMutation({ document: pausePomodoroGQL })
const { mutate: updatePomodoroProgressMutation } = initMutation({ document: updatePomodoroProgressGQL })

// === State ===
const settings = ref<PomodoroSettings>({
  workDuration: 25, // minutes
  shortBreakDuration: 5, // minutes
  longBreakDuration: 15, // minutes
  pomodorosBeforeLongBreak: 4,
  showNotification: true,
  playSoundOnComplete: true,
})
const isRunning = ref(false)
const isPaused = ref(false)
const timeLeft = ref(0) // remaining seconds
const totalTime = ref(0) // total time
const currentPhase = ref<'work' | 'shortBreak' | 'longBreak'>('work')
const currentRound = ref(1)
const completedToday = ref(0) // Will be loaded from API

// === Notification Warning ===
const { hasWarning: hasNotificationWarning, warningMessage: notificationWarningMessage, warningAction: notificationWarningAction, notificationPermission, grantPermission: grantNotificationPermission, useHttpsLink: useHttpsLinkAction } = useNotificationWarning({ showToast: true })

// === Timer Management ===
let timer: number | null = null

// === WebSocket Event Handlers ===
function handlePomodoroAction(data: any) {
  if (!data) return

  console.log('Received pomodoro_action:', data)

  // Update state based on WebSocket event
  if (data.timeLeft !== undefined) {
    timeLeft.value = data.timeLeft
  }
  if (data.totalTime !== undefined) {
    totalTime.value = data.totalTime
  }
  if (data.completedCount !== undefined) {
    completedToday.value = data.completedCount
  }
  if (data.round !== undefined) {
    currentRound.value = data.round
  }
  if (data.state !== undefined) {
    // Map backend state to component state
    const stateMapping: { [key: string]: 'work' | 'shortBreak' | 'longBreak' } = {
      WORK: 'work',
      SHORT_BREAK: 'shortBreak',
      LONG_BREAK: 'longBreak',
    }
    currentPhase.value = stateMapping[data.state] || 'work'
  }

  // Handle different actions - only update UI state, don't call mutations
  switch (data.action) {
    case 'start':
      isRunning.value = true
      isPaused.value = false
      if (timeLeft.value > 0) {
        startTimerInterval()
      }
      break
    case 'pause':
      isRunning.value = false
      isPaused.value = true
      clearTimer()
      break
    case 'stop':
      isRunning.value = false
      isPaused.value = false
      clearTimer()
      break
  }
}

function handlePomodoroSettingsUpdate(data: any) {
  if (!data) return

  // Update settings with new values from WebSocket
  settings.value = {
    ...settings.value,
    ...data,
  }

  // If timer is not running and we're at initial state, reinitialize with new duration
  if (!isRunning.value && !isPaused.value && timeLeft.value === totalTime.value) {
    initTimer(currentPhase.value)
  }
}

// === Data Loading ===

// Load settings and today's pomodoro state from backend
initQuery({
  document: pomodoroTodayAndSettingsGQL,
  handle: (data: any, error: string) => {
    if (error) {
      console.error('Failed to load pomodoro data:', error)
      toast(t('failed_to_load_pomodoro_data'), 'error')
      return
    }

    console.log('Received data from API:', data)

    if (!data) {
      console.log('No data received')
      return
    }

    const { pomodoroSettings, pomodoroToday } = data
    console.log('pomodoroToday:', pomodoroToday)
    console.log('pomodoroSettings:', pomodoroSettings)

    // Update settings
    if (pomodoroSettings) {
      settings.value = pomodoroSettings
    }

    // Update today's state
    if (pomodoroToday && pomodoroToday.totalTime > 0) {
      console.log('Updating today state with:', pomodoroToday)

      completedToday.value = pomodoroToday.completedCount || 0
      currentRound.value = pomodoroToday.currentRound || 1
      timeLeft.value = pomodoroToday.timeLeft || 0
      totalTime.value = pomodoroToday.totalTime
      isRunning.value = pomodoroToday.isRunning || false
      isPaused.value = pomodoroToday.isPause || false

      if (pomodoroToday.state) {
        // Map backend state to component state
        const stateMapping: { [key: string]: 'work' | 'shortBreak' | 'longBreak' } = {
          WORK: 'work',
          SHORT_BREAK: 'shortBreak',
          LONG_BREAK: 'longBreak',
        }
        currentPhase.value = stateMapping[pomodoroToday.state] || 'work'
        console.log('Mapped state from', pomodoroToday.state, 'to', currentPhase.value)
      }

      console.log('Updated state:', {
        timeLeft: timeLeft.value,
        totalTime: totalTime.value,
        isRunning: isRunning.value,
        isPaused: isPaused.value,
        currentPhase: currentPhase.value,
      })

      // Resume timer if it was running
      if (isRunning.value && !isPaused.value && timeLeft.value > 0) {
        console.log('Starting timer interval')
        startTimerInterval()
      }
    } else {
      console.log('No valid pomodoroToday data or totalTime is 0')
    }
  },
})

// === Computed Properties ===
const circumference = 2 * Math.PI * 110
const strokeDashoffset = computed(() => {
  const progress = totalTime.value > 0 ? (totalTime.value - timeLeft.value) / totalTime.value : 0
  return circumference * (1 - progress)
})

// === Helper Functions ===
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Get current phase text
function getCurrentPhaseText(): string {
  switch (currentPhase.value) {
    case 'work':
      return t('work_time')
    case 'shortBreak':
      return t('short_break')
    case 'longBreak':
      return t('long_break')
    default:
      return ''
  }
}

// === Timer Core Functions ===
// Initialize timer
function initTimer(phase: 'work' | 'shortBreak' | 'longBreak') {
  currentPhase.value = phase
  let duration: number

  switch (phase) {
    case 'work':
      duration = settings.value.workDuration
      break
    case 'shortBreak':
      duration = settings.value.shortBreakDuration
      break
    case 'longBreak':
      duration = settings.value.longBreakDuration
      break
  }

  timeLeft.value = duration * 60
  totalTime.value = duration * 60
}

// Utility function to set timer state
function setTimerState(running: boolean, paused: boolean) {
  isRunning.value = running
  isPaused.value = paused
  if (!running) {
    clearTimer()
  }
}

// Start timer interval
function startTimerInterval() {
  // Clear existing timer first to prevent multiple intervals
  clearTimer()
  timer = setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--
    } else {
      timerComplete()
    }
  }, 1000)
}

// Start timer
function startTimer() {
  if (timeLeft.value === 0) {
    initTimer('work')
  }

  setTimerState(true, false)

  // Call start pomodoro mutation to notify app
  startPomodoroMutation().catch((error) => {
    console.error('Failed to start pomodoro:', error)
  })

  startTimerInterval()
}

// Pause timer
function pauseTimer() {
  setTimerState(false, true)

  // Call pause pomodoro mutation to notify app
  pausePomodoroMutation().catch((error) => {
    console.error('Failed to pause pomodoro:', error)
  })
}

// Resume timer (alias for startTimer for semantic clarity)
const resumeTimer = startTimer

// Clear timer interval
function clearTimer() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

// Stop timer
function stopTimer() {
  setTimerState(false, false)

  // Call stop pomodoro mutation to notify app
  stopPomodoroMutation().catch((error) => {
    console.error('Failed to stop pomodoro:', error)
  })

  // Reset to initial time for current phase
  initTimer(currentPhase.value)
}

function handleClick(event: MouseEvent) {
  if (totalTime.value === 0) return

  event.preventDefault()

  const svg = event.currentTarget as SVGElement
  const rect = svg.getBoundingClientRect()
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  const dx = event.clientX - centerX
  const dy = event.clientY - centerY

  let angle = Math.atan2(dx, -dy)
  if (angle < 0) angle += 2 * Math.PI

  const progress = angle / (2 * Math.PI)
  const elapsedTime = Math.round(progress * totalTime.value)
  timeLeft.value = Math.max(0, totalTime.value - elapsedTime)
  setTimerState(true, false)
  // Call update progress mutation to notify app about time adjustment
  updatePomodoroProgressMutation({ timeLeft: timeLeft.value }).catch((error) => {
    console.error('Failed to update pomodoro progress:', error)
  })
  startTimerInterval()
}

// Timer complete
function timerComplete() {
  setTimerState(false, false)

  // Play notification
  if (settings.value.playSoundOnComplete) {
    playNotificationSound()
  }

  if (settings.value.showNotification) {
    showNotification()
  }

  if (currentPhase.value === 'work') {
    // Work completed, increase count
    completedToday.value++

    // Decide next phase
    if (currentRound.value >= settings.value.pomodorosBeforeLongBreak) {
      initTimer('longBreak')
      currentRound.value = 1
      // Show notification or toast for long break
      if (!settings.value.showNotification) {
        toast(t('long_break_time'))
      }
    } else {
      initTimer('shortBreak')
      currentRound.value++
      // Show notification or toast for short break
      if (!settings.value.showNotification) {
        toast(t('short_break_time'))
      }
    }
  } else {
    // Break completed, prepare for work
    initTimer('work')
    // Show notification or toast for work time
    if (!settings.value.showNotification) {
      toast(t('work_time_start'))
    }
  }
}

// === Notification Functions ===
// Show system notification
function showNotification() {
  const title = currentPhase.value === 'work' ? t('work_completed') : t('break_completed')
  const body = currentPhase.value === 'work' ? t('time_for_break') : t('time_for_work')

  // Try desktop notification first
  if ('Notification' in window && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    const notification = new Notification(title, {
      body,
      icon: '/favicon.ico',
    })

    // Handle notification click
    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } else {
    // Fallback to toast message if no desktop notification permission
    toast(`${title} - ${body}`, 'success')
  }
}

// Request notification permission
function requestNotificationPermission() {
  if ('Notification' in window && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    Notification.requestPermission().then((permission) => {
      notificationPermission.value = permission
    })
  }
}

// === Lifecycle Hooks ===
onMounted(() => {
  requestNotificationPermission()

  // Set default state if no data loaded from API
  if (totalTime.value === 0) {
    initTimer('work')
  }

  // Register WebSocket event listeners
  emitter.on('pomodoro_action', handlePomodoroAction)
  emitter.on('pomodoro_settings_update', handlePomodoroSettingsUpdate)
})

onUnmounted(() => {
  clearTimer()

  // Unregister WebSocket event listeners
  emitter.off('pomodoro_action', handlePomodoroAction)
  emitter.off('pomodoro_settings_update', handlePomodoroSettingsUpdate)
})

// Watch settings changes, update time if timer is not running
watch(
  settings,
  () => {
    if (!isRunning.value && !isPaused.value && timeLeft.value === 0) {
      initTimer('work')
    }
  },
  { deep: true }
)
</script>

<style lang="scss" scoped>
.timer-container {
  padding: 32px 16px 16px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.status-display {
  text-align: center;

  .current-phase {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-bottom: 8px;
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
  }

  .round-info {
    font-size: 0.875rem;
    color: var(--md-sys-color-on-surface-variant);
  }
}

.timer-circle {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;

  .circle-progress {
    &.adjustable {
      cursor: pointer;

      &:hover .progress-ring {
        stroke-width: 10;
      }
    }
  }

  .progress-ring {
    transition:
      stroke-dashoffset 0.3s ease,
      stroke-width 0.2s ease;
  }

  .timer-content {
    position: absolute;
    text-align: center;
    pointer-events: none;

    .time-display {
      font-size: 2.5rem;
      font-weight: bold;
      color: var(--md-sys-color-on-surface);
      font-family: 'Courier New', monospace;
    }

    .time-label {
      font-size: 0.875rem;
      color: var(--md-sys-color-on-surface-variant);
      margin-top: 4px;
    }

    .click-hint {
      font-size: 0.75rem;
      color: var(--md-sys-color-on-surface-variant);
      margin-top: 8px;
      opacity: 0.7;
    }
  }
}

.timer-controls {
  display: flex;
  gap: 12px;

  button {
    &.v-filled-button {
      min-width: 140px;
    }
    &.btn-start,
    &.btn-resume {
      background: var(--md-sys-color-primary);
      color: var(--md-sys-color-on-primary);
    }

    &.btn-pause {
      background: var(--md-sys-color-secondary);
      color: var(--md-sys-color-on-secondary);
    }

    &.btn-stop {
      background: var(--md-sys-color-error);
      color: var(--md-sys-color-on-error);
    }
  }
}

.daily-stats {
  text-align: center;
  padding: 16px;

  .stats-title {
    font-size: 0.875rem;
    color: var(--md-sys-color-on-surface-variant);
    margin-bottom: 8px;
  }

  .tomato-display {
    display: flex;
    justify-content: center;
    gap: 4px;
    margin-bottom: 8px;
    flex-wrap: wrap;

    .tomato-icon {
      font-size: 1.5rem;
      opacity: 0.3;
      transition: opacity 0.2s ease;

      &.completed {
        opacity: 1;
      }
    }
  }

  .stats-number {
    font-size: 1rem;
    font-weight: 500;
    color: var(--md-sys-color-on-surface);
  }
}

</style>
