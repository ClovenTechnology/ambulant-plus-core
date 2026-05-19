'use client';

import {
  type NexRingSdkAny,
  getExactCommandValue,
} from './nexring-sdk';
import { buildNexRingCommandPacket } from './nexring-protocol';

type Writer = (bytes: Uint8Array) => Promise<void>;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendPacket(writer: Writer, packet: Uint8Array) {
  await writer(packet);
}

function requireCommand(
  sdk: NexRingSdkAny,
  candidates: string[],
  label: string,
): string | number {
  const cmd = getExactCommandValue(sdk, candidates);
  if (typeof cmd !== 'string' && typeof cmd !== 'number') {
    throw new Error(`Missing SDK SendCmd for ${label}`);
  }
  return cmd;
}

export type SentPacketResult = {
  ts: number;
  label: string;
  cmd: string | number;
  packet: Uint8Array;
};

export class NexRingWebCommands {
  constructor(
    private readonly sdk: NexRingSdkAny,
    private readonly writer: Writer,
  ) {}

  private async send(
    label: string,
    candidates: string[],
    payload: number[] = [],
  ): Promise<SentPacketResult> {
    const cmd = requireCommand(this.sdk, candidates, label);
    const packet = buildNexRingCommandPacket(this.sdk, cmd, payload);
    await sendPacket(this.writer, packet);
    return { ts: Date.now(), label, cmd, packet };
  }

  async sendTimeSync(payload: number[] = []) {
    return this.send('timeSync', ['timeSyn'], payload);
  }

  async sendBatteryRequest(payload: number[] = []) {
    return this.send('batteryDataAndState', ['batteryDataAndState'], payload);
  }

  async sendDeviceInfo1() {
    return this.send('deviceInfo1', ['deviceInfo1']);
  }

  async sendDeviceInfo2() {
    return this.send('deviceInfo2', ['deviceInfo2']);
  }

  async sendDeviceInfo5() {
    return this.send('deviceInfo5', ['deviceInfo5']);
  }

  async sendDeviceInfoRequests() {
    const out: SentPacketResult[] = [];
    out.push(await this.sendDeviceInfo1());
    out.push(await this.sendDeviceInfo2());
    out.push(await this.sendDeviceInfo5());
    return out;
  }

  async sendHistoricalNum() {
    return this.send('historicalNum', ['historicalNum']);
  }

  async sendHistoricalData() {
    return this.send('historicalData', ['historicalData']);
  }

  async sendActiveData() {
    return this.send('ACTIVE_DATA', ['ACTIVE_DATA']);
  }

  async sendActiveData2() {
    return this.send('ACTIVE_DATA_2', ['ACTIVE_DATA_2']);
  }

  async sendNewAlgorithmHistoryNum() {
    return this.send('NEW_ALGORITHM_HISTORY_NUM', ['NEW_ALGORITHM_HISTORY_NUM']);
  }

  async sendNewAlgorithmHistoryData() {
    return this.send('NEW_ALGORITHM_HISTORY', ['NEW_ALGORITHM_HISTORY']);
  }

  async sendOxSettings(payload: number[] = []) {
    return this.send('oxSettings', ['oxSettings'], payload);
  }

  async openHealth() {
    return this.send('openHealth', ['openHealth']);
  }

  async closeHealth() {
    return this.send('closeHealth', ['closeHealth']);
  }

  async openSingleHealth() {
    return this.send('openSingleHealth', ['openSingleHealth']);
  }

  async closeSingleHealth() {
    return this.send('closeSingleHealth', ['closeSingleHealth']);
  }

  async sendStepRequest() {
    return this.send('step', ['step']);
  }

  async sendTemperatureRequest() {
    return this.send('temperature', ['temperature']);
  }

  async sendSetHealthPara(payload: number[] = []) {
    return this.send('setHealthPara', ['setHealthPara'], payload);
  }

  async sendSetPpg(payload: number[] = []) {
    return this.send('SET_PPG', ['SET_PPG'], payload);
  }

  async sendExercise(payload: number[] = []) {
    return this.send('SET_EXERCISE', ['SET_EXERCISE'], payload);
  }

  async sendMeasurementTiming(payload: number[] = []) {
    return this.send('SET_MEASUREMENT_TIMING', ['SET_MEASUREMENT_TIMING'], payload);
  }

  async sendBootHandshake(delays = { afterTimeSync: 250, betweenInfo: 180, beforeHistoryNum: 250 }) {
    const out: SentPacketResult[] = [];

    out.push(await this.sendTimeSync());
    await sleep(delays.afterTimeSync);

    out.push(await this.sendDeviceInfo1());
    await sleep(delays.betweenInfo);

    out.push(await this.sendDeviceInfo2());
    await sleep(delays.betweenInfo);

    out.push(await this.sendDeviceInfo5());
    await sleep(delays.beforeHistoryNum);

    out.push(await this.sendHistoricalNum());

    return out;
  }

  async sendPassiveHydrationBootstrap(
    delays = {
      afterHistoricalNum: 380,
      afterHistoricalData: 420,
      betweenActive: 240,
      betweenAlgorithm: 320,
      beforeStep: 180,
    },
  ) {
    const out: SentPacketResult[] = [];

    out.push(await this.sendHistoricalNum());
    await sleep(delays.afterHistoricalNum);

    out.push(await this.sendHistoricalData());
    await sleep(delays.afterHistoricalData);

    out.push(await this.sendActiveData());
    await sleep(delays.betweenActive);

    out.push(await this.sendActiveData2());
    await sleep(delays.betweenActive);

    out.push(await this.sendNewAlgorithmHistoryNum());
    await sleep(delays.betweenAlgorithm);

    out.push(await this.sendNewAlgorithmHistoryData());
    await sleep(delays.beforeStep);

    out.push(await this.sendStepRequest());
    await sleep(180);

    out.push(await this.sendTemperatureRequest());

    return out;
  }

  async sendLiveHealthStart(delays = { afterHealthOpen: 220 }) {
    const out: SentPacketResult[] = [];
    out.push(await this.openHealth());
    await sleep(delays.afterHealthOpen);
    return out;
  }

  async sendLiveHealthStop() {
    const out: SentPacketResult[] = [];
    out.push(await this.closeHealth());
    return out;
  }

  async sendSingleMeasurementStart(delays = { afterOpen: 220 }) {
    const out: SentPacketResult[] = [];
    out.push(await this.openSingleHealth());
    await sleep(delays.afterOpen);
    return out;
  }

  async sendSingleMeasurementStop() {
    const out: SentPacketResult[] = [];
    out.push(await this.closeSingleHealth());
    return out;
  }

  async sendPassiveModeStop(delays = { betweenStops: 160 }) {
    const out: SentPacketResult[] = [];
    out.push(await this.closeSingleHealth());
    await sleep(delays.betweenStops);
    out.push(await this.closeHealth());
    return out;
  }
}