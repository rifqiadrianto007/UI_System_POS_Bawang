import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Receipt } from "../types";

const calls: string[] = [];
let deviceKnown = false;
let connectError: Error | null = null;

vi.mock("./printerService", () => ({
  connect: vi.fn(async () => {
    calls.push("connect");
    if (connectError) throw connectError;
  }),
  hasDevice: () => deviceKnown,
  isBluetoothPreferred: () => true,
  isPrinterSupported: () => true,
}));

vi.mock("./printReceipt", () => ({
  printReceiptBluetooth: vi.fn(async () => {
    calls.push("print");
  }),
}));

import { printViaBluetooth, shouldUseBluetooth } from "./printFlow";

const receipt = { occurred_at: "2026-11-25T10:00:00+07:00", items: [], discount: 0, total: 0 } as unknown as Receipt;
const getReceipt = async () => {
  calls.push("fetch");
  return receipt;
};

function tap(active: boolean | undefined) {
  vi.stubGlobal("navigator", active === undefined ? {} : { userActivation: { isActive: active } });
}

beforeEach(() => {
  calls.length = 0;
  deviceKnown = false;
  connectError = null;
  tap(true);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("printViaBluetooth", () => {
  it("sesi baru dengan sentuhan segar: sambung dulu, baru ambil struk, lalu cetak", async () => {
    await printViaBluetooth(getReceipt);
    expect(calls).toEqual(["connect", "fetch", "print"]);
  });

  it("printer sudah dipilih: tidak membuka dialog lagi", async () => {
    deviceKnown = true;
    await printViaBluetooth(getReceipt);
    expect(calls).toEqual(["fetch", "print"]);
  });

  it("sentuhan sudah kedaluwarsa: dialog dilewati, pencetakan dilanjutkan", async () => {
    tap(false);
    await printViaBluetooth(getReceipt);
    expect(calls).toEqual(["fetch", "print"]);
  });

  it("browser tanpa userActivation dianggap boleh membuka dialog", async () => {
    tap(undefined);
    await printViaBluetooth(getReceipt);
    expect(calls[0]).toBe("connect");
  });

  it("pemilihan printer dibatalkan: tidak mengambil struk dan tidak mencetak", async () => {
    connectError = new Error("dibatalkan");
    await expect(printViaBluetooth(getReceipt)).rejects.toThrow("dibatalkan");
    expect(calls).toEqual(["connect"]);
  });

  it("struk gagal diambil: tidak mencetak", async () => {
    deviceKnown = true;
    await expect(printViaBluetooth(async () => { throw new Error("jaringan"); })).rejects.toThrow("jaringan");
    expect(calls).toEqual([]);
  });
});

describe("shouldUseBluetooth", () => {
  it("true bila browser mendukung dan printer pernah dipilih", () => {
    expect(shouldUseBluetooth()).toBe(true);
  });
});
