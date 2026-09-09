# @file windows-host.ps1
# @description 独立 Job Object 托管本次服务；控制管道结束时清理整个子进程树
param([string]$NodePath, [string]$Directory, [string]$ArgumentsBase64)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
Add-Type -TypeDefinition @'
using System;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
public static class DevJob {
  public static Task<string> ReadControl() { return Task.Run(() => Console.In.ReadLine()); }
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll")] static extern bool SetInformationJobObject(IntPtr job, int info, IntPtr data, uint size);
  [DllImport("kernel32.dll")] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
  [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr handle);
  [StructLayout(LayoutKind.Sequential)] struct Basic {
    public long ProcessTime, JobTime;
    public uint Flags;
    public UIntPtr MinWorking, MaxWorking;
    public uint ActiveProcesses;
    public UIntPtr Affinity;
    public uint Priority, Scheduling;
  }
  [StructLayout(LayoutKind.Sequential)] struct IO { public ulong ReadOps, WriteOps, OtherOps, ReadBytes, WriteBytes, OtherBytes; }
  [StructLayout(LayoutKind.Sequential)] struct Extended {
    public Basic Limits;
    public IO Counters;
    public UIntPtr ProcessMemory, JobMemory, PeakProcess, PeakJob;
  }
  public static IntPtr Create() {
    var job = CreateJobObject(IntPtr.Zero, null);
    if (job == IntPtr.Zero) throw new Exception("Cannot create service Job Object");
    var info = new Extended(); info.Limits.Flags = 0x2000;
    var memory = Marshal.AllocHGlobal(Marshal.SizeOf(info));
    try {
      Marshal.StructureToPtr(info, memory, false);
      if (!SetInformationJobObject(job, 9, memory, (uint)Marshal.SizeOf(info)) ||
          !AssignProcessToJobObject(job, Process.GetCurrentProcess().Handle)) {
        CloseHandle(job); throw new Exception("Cannot isolate service process; startup cancelled");
      }
    } finally { Marshal.FreeHGlobal(memory); }
    return job;
  }
  public static string Quote(string value) {
    return "\"" + Regex.Replace(Regex.Replace(value, "(\\\\*)\"", "$1$1\\\""), "(\\\\+)$", "$1$1") + "\"";
  }
  public static Process Start(string node, string directory, string[] args) {
    var info = new ProcessStartInfo(node);
    info.WorkingDirectory = directory; info.UseShellExecute = false; info.CreateNoWindow = true;
    info.RedirectStandardOutput = true; info.RedirectStandardError = true; info.RedirectStandardInput = true;
    info.StandardOutputEncoding = System.Text.Encoding.UTF8; info.StandardErrorEncoding = System.Text.Encoding.UTF8;
    info.Arguments = String.Join(" ", Array.ConvertAll(args, Quote));
    var child = new Process(); child.StartInfo = info;
    child.OutputDataReceived += (sender, e) => { if (e.Data != null) Console.Out.WriteLine(e.Data); };
    child.ErrorDataReceived += (sender, e) => { if (e.Data != null) Console.Error.WriteLine(e.Data); };
    child.Start(); child.StandardInput.Close(); Console.Out.WriteLine("Service pid: " + child.Id);
    child.BeginOutputReadLine(); child.BeginErrorReadLine(); return child;
  }
}
'@
$job = [DevJob]::Create()
try {
  $decoded = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($ArgumentsBase64)) | ConvertFrom-Json
  $serviceProcess = [DevJob]::Start($NodePath, $Directory, [string[]]$decoded)
  $control = [DevJob]::ReadControl()
  while (-not $serviceProcess.HasExited -and -not $control.IsCompleted) { Start-Sleep -Milliseconds 100 }
  if ($serviceProcess.HasExited) { [Console]::Error.WriteLine('Service exited: ' + $serviceProcess.ExitCode) }
} finally {
  # Job 包含托管进程本身；关闭最后一个句柄会同时终止全部后代。
  [DevJob]::CloseHandle($job) | Out-Null
}
