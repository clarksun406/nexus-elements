<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { bridge } from '../bridge'

const options = ref<Record<string, unknown>>({})
const step = ref<'contact' | 'otp' | 'verified'>('contact')
const mode = ref<'phone' | 'email'>('phone')
const phone = ref('')
const email = ref('')
const otp = ref(['', '', '', '', '', ''])
const error = ref('')
const sending = ref(false)
const verifying = ref(false)
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const contactValue = computed(() => mode.value === 'phone' ? phone.value : email.value)
const isContactValid = computed(() => {
  if (mode.value === 'phone') return phone.value.replace(/\D/g, '').length >= 10
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)
})
const otpValue = computed(() => otp.value.join(''))
const isOtpComplete = computed(() => otpValue.value.length === 6)

const isEmpty = computed(() => step.value === 'contact' ? !contactValue.value : step.value === 'otp')
const isComplete = computed(() => step.value === 'verified')

watch([isComplete, isEmpty], () => {
  bridge.send('nexus:change', {
    complete: isComplete.value,
    empty: isEmpty.value,
    valid: isComplete.value,
    elementType: 'linkAuthentication',
    value: step.value === 'verified' ? {
      contact: contactValue.value,
      mode: mode.value,
      email: mode.value === 'email' ? email.value : undefined,
      phone: mode.value === 'phone' ? phone.value : undefined,
    } : undefined,
  })
})

function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

function onPhoneInput(event: Event) {
  const input = event.target as HTMLInputElement
  phone.value = formatPhone(input.value)
}

function startCountdown() {
  countdown.value = 30
  countdownTimer = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      if (countdownTimer) clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

function sendCode() {
  if (!isContactValid.value) return
  error.value = ''
  sending.value = true

  setTimeout(() => {
    sending.value = false
    step.value = 'otp'
    startCountdown()
    setTimeout(() => {
      const firstOtp = document.querySelector('.nexus-otp-input') as HTMLInputElement
      firstOtp?.focus()
    }, 50)
  }, 800)
}

function onOtpInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const val = input.value.replace(/\D/g, '').slice(0, 1)
  otp.value[index] = val

  if (val && index < 5) {
    const next = document.querySelectorAll('.nexus-otp-input')[index + 1] as HTMLInputElement
    next?.focus()
  }
}

function onOtpKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !otp.value[index] && index > 0) {
    const prev = document.querySelectorAll('.nexus-otp-input')[index - 1] as HTMLInputElement
    prev?.focus()
    otp.value[index - 1] = ''
  }
}

function verifyOtp() {
  if (!isOtpComplete.value) return
  error.value = ''
  verifying.value = true

  setTimeout(() => {
    verifying.value = false
    step.value = 'verified'
    bridge.send('nexus:ready', { elementType: 'linkAuthentication' })
  }, 600)
}

function resendCode() {
  if (countdown.value > 0) return
  otp.value = ['', '', '', '', '', '']
  startCountdown()
}

function backToContact() {
  step.value = 'contact'
  otp.value = ['', '', '', '', '', '']
  error.value = ''
  if (countdownTimer) clearInterval(countdownTimer)
  countdown.value = 0
}

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  const m = options.value.mode as string | undefined
  if (m === 'email' || m === 'phone') mode.value = m
  const defaults = options.value.defaultValues as { phone?: string; email?: string } | undefined
  if (defaults?.phone) phone.value = formatPhone(defaults.phone)
  if (defaults?.email) email.value = defaults.email
  bridge.send('nexus:ready', { elementType: 'linkAuthentication' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }
})

bridge.on('nexus:clear', () => {
  phone.value = ''
  email.value = ''
  otp.value = ['', '', '', '', '', '']
  step.value = 'contact'
  error.value = ''
})

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})
</script>

<template>
  <div class="nexus-link-element">
    <!-- Step 1: Contact info -->
    <div v-if="step === 'contact'" class="nexus-link-contact">
      <div class="nexus-link-header">
        <span class="nexus-link-title">Sign in with Link</span>
      </div>

      <div class="nexus-link-mode-toggle">
        <button :class="{ active: mode === 'phone' }" @click="mode = 'phone'">手机号</button>
        <button :class="{ active: mode === 'email' }" @click="mode = 'email'">邮箱</button>
      </div>

      <label v-if="mode === 'phone'" class="nexus-label">
        手机号
        <input
          class="nexus-input nexus-link-phone"
          type="tel"
          inputmode="numeric"
          placeholder="+1 (555) 123-4567"
          aria-label="手机号"
          :value="phone"
          @input="onPhoneInput"
        />
      </label>

      <label v-else class="nexus-label">
        邮箱
        <input
          class="nexus-input nexus-link-email"
          type="email"
          placeholder="you@example.com"
          aria-label="邮箱"
          v-model="email"
        />
      </label>

      <button class="nexus-link-send-btn" :disabled="!isContactValid || sending" @click="sendCode">
        {{ sending ? '发送中...' : '发送验证码' }}
      </button>

      <p v-if="error" class="nexus-error" role="alert">{{ error }}</p>
    </div>

    <!-- Step 2: OTP verification -->
    <div v-if="step === 'otp'" class="nexus-link-otp">
      <div class="nexus-link-header">
        <span class="nexus-link-title">输入验证码</span>
        <span class="nexus-link-subtitle">
          已发送{{ mode === 'phone' ? '短信' : '邮件' }}至 {{ contactValue }}
        </span>
      </div>

      <div class="nexus-otp-group">
        <input
          v-for="(_, i) in 6"
          :key="i"
          class="nexus-input nexus-otp-input"
          type="text"
          inputmode="numeric"
          maxlength="1"
          :aria-label="`验证码第 ${i + 1} 位`"
          :value="otp[i]"
          @input="onOtpInput(i, $event)"
          @keydown="onOtpKeydown(i, $event)"
        />
      </div>

      <button class="nexus-link-send-btn" :disabled="!isOtpComplete || verifying" @click="verifyOtp">
        {{ verifying ? '验证中...' : '验证' }}
      </button>

      <div class="nexus-link-otp-actions">
        <button class="nexus-link-text-btn" :disabled="countdown > 0" @click="resendCode">
          {{ countdown > 0 ? `重新发送 (${countdown}s)` : '重新发送验证码' }}
        </button>
        <button class="nexus-link-text-btn" @click="backToContact">&larr; 更换{{ mode === 'phone' ? '手机号' : '邮箱' }}</button>
      </div>

      <p v-if="error" class="nexus-error" role="alert">{{ error }}</p>
    </div>

    <!-- Step 3: Verified -->
    <div v-if="step === 'verified'" class="nexus-link-verified">
      <div class="nexus-link-check">&#10003;</div>
      <span class="nexus-link-title">已验证</span>
      <span class="nexus-link-subtitle">{{ contactValue }}</span>
    </div>
  </div>
</template>

<style scoped>
.nexus-link-element {
  font-family: -apple-system, 'Segoe UI', sans-serif;
  padding: 4px 0;
}

.nexus-link-header {
  margin-bottom: 12px;
}

.nexus-link-title {
  display: block;
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.nexus-link-subtitle {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-top: 2px;
}

.nexus-link-mode-toggle {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
  background: #f3f4f6;
  border-radius: 6px;
  padding: 3px;
}

.nexus-link-mode-toggle button {
  flex: 1;
  padding: 6px;
  border: none;
  border-radius: 4px;
  background: transparent;
  font-size: 12px;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.15s;
}

.nexus-link-mode-toggle button.active {
  background: #fff;
  color: #1f2937;
  box-shadow: 0 1px 2px rgba(0,0,0,0.08);
}

.nexus-label {
  display: block;
  font-size: 13px;
  color: #4b5563;
  margin-bottom: 10px;
}

.nexus-input {
  display: block;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 15px;
  margin-top: 4px;
  transition: border-color 0.15s, box-shadow 0.15s;
}

.nexus-input:focus {
  outline: none;
  border-color: #635bff;
  box-shadow: 0 0 0 3px rgba(99,91,255,0.15);
}

.nexus-input::placeholder {
  color: var(--nexus-color-text-placeholder, #8792a2);
}

.nexus-link-send-btn {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 8px;
  background: #635bff;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.nexus-link-send-btn:hover:not(:disabled) {
  background: #5147e5;
}

.nexus-link-send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.nexus-otp-group {
  display: flex;
  gap: 8px;
  margin-bottom: 14px;
  justify-content: center;
}

.nexus-otp-input {
  width: 42px;
  height: 50px;
  text-align: center;
  font-size: 20px;
  font-weight: 600;
  padding: 0;
  margin-top: 0;
  border-radius: 8px;
}

.nexus-link-otp-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}

.nexus-link-text-btn {
  background: none;
  border: none;
  color: #635bff;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 0;
  text-align: center;
}

.nexus-link-text-btn:hover:not(:disabled) {
  text-decoration: underline;
}

.nexus-link-text-btn:disabled {
  color: #9ca3af;
  cursor: not-allowed;
}

.nexus-link-verified {
  text-align: center;
  padding: 16px 0;
}

.nexus-link-check {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #059669;
  color: #fff;
  font-size: 20px;
  line-height: 40px;
  margin: 0 auto 8px;
}

.nexus-error {
  color: #dc2626;
  font-size: 13px;
  margin-top: 8px;
}
</style>
