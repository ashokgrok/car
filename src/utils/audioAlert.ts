/**
 * Web Audio API Synthesizer & Browser Notification Service
 * Generates immediate, crisp operational acoustic alerts for CRITICAL transitions & SLA breaches
 * without requiring external sound files.
 */

class SoundAlertService {
  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;

  constructor() {
    // Read saved preference from localStorage
    const saved = localStorage.getItem('car_audio_alert_enabled');
    if (saved !== null) {
      this.soundEnabled = saved === 'true';
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  public isAudioEnabled(): boolean {
    return this.soundEnabled;
  }

  public setAudioEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    localStorage.setItem('car_audio_alert_enabled', String(enabled));
  }

  /**
   * Play Critical Alert Chime (Section 38: Audible Alert on CRITICAL or SLA breach)
   * Urgent dual-frequency alert: 880Hz -> 587.33Hz pulses
   */
  public playCriticalChime() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      // Pulse 1
      this.playTone(ctx, 880, now, 0.15, 'triangle');
      this.playTone(ctx, 587.33, now + 0.12, 0.25, 'sine');

      // Pulse 2
      this.playTone(ctx, 880, now + 0.35, 0.15, 'triangle');
      this.playTone(ctx, 587.33, now + 0.47, 0.3, 'sine');
    } catch (err) {
      console.warn('Audio chime playback suppressed by browser policy:', err);
    }
  }

  /**
   * Play Warning / Attention Chime (AT_RISK connection shift)
   */
  public playWarningChime() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      this.playTone(ctx, 523.25, now, 0.12, 'sine');
      this.playTone(ctx, 659.25, now + 0.1, 0.2, 'sine');
    } catch (err) {
      console.warn('Audio chime suppressed:', err);
    }
  }

  /**
   * Play Soft Action / Batch Acknowledged Chime
   */
  public playSuccessChime() {
    if (!this.soundEnabled) return;
    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      this.playTone(ctx, 440, now, 0.08, 'sine');
      this.playTone(ctx, 659.25, now + 0.08, 0.18, 'sine');
    } catch (err) {
      console.warn('Audio chime suppressed:', err);
    }
  }

  private playTone(ctx: AudioContext, freq: number, startTime: number, duration: number, type: OscillatorType) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.exponentialRampToValueAtTime(0.18, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  // Browser Desktop Web Notifications
  public async requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return await Notification.requestPermission();
  }

  public getNotificationPermission(): NotificationPermission {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  public sendDesktopNotification(title: string, body: string) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: 'car-alert'
        });
      } catch (e) {
        console.warn('Desktop notification failed:', e);
      }
    }
  }
}

export const soundAlerts = new SoundAlertService();
