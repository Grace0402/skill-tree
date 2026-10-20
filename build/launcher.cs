using System;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;
using System.Reflection;

[assembly: AssemblyTitle("个人技能树")]
[assembly: AssemblyProduct("个人技能树")]
[assembly: AssemblyCompany("Skill Tree")]
[assembly: AssemblyDescription("成长足迹树：记录你点亮了什么、长出了什么。")]
[assembly: AssemblyFileVersion("1.0.0.0")]
[assembly: AssemblyVersion("1.0.0.0")]

/// <summary>
/// 技能树启动器。
/// 先按默认方式启动 SkillTree-app.exe；若它在初始化阶段立即崩溃
/// （某些 Windows 会话无法创建 Chromium 沙箱子进程，退出码 0x80000003），
/// 则自动带 --no-sandbox 再启动一次。正常机器上不会关闭沙箱。
/// </summary>
internal static class Program
{
    private const string AppExe = "SkillTree-app.exe";
    private const int CrashProbeMs = 1800;
    private const int FallbackProbeMs = 2000;

    [STAThread]
    private static int Main(string[] args)
    {
        string baseDir = AppDomain.CurrentDomain.BaseDirectory;
        string appPath = Path.Combine(baseDir, AppExe);
        string argsText = JoinArgs(args);

        if (!File.Exists(appPath))
        {
            MessageBox.Show(
                "找不到 " + AppExe + "。\r\n\r\n请确认解压时保留了整个文件夹，不要只复制 SkillTree.exe。",
                "个人技能树",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 2;
        }

        try
        {
            Process first = Start(appPath, baseDir, argsText);
            if (first == null)
            {
                return StartFallback(appPath, baseDir, argsText, "无法创建进程");
            }

            if (!first.WaitForExit(CrashProbeMs))
            {
                // 3 秒后仍在运行：视为正常启动，启动器退出。
                return 0;
            }

            if (first.ExitCode == 0)
            {
                // 正常退出，或已有实例在运行（单实例锁会让第二个进程返回 0）。
                return 0;
            }

            return StartFallback(appPath, baseDir, argsText, "退出码 " + first.ExitCode);
        }
        catch (Exception ex)
        {
            return StartFallback(appPath, baseDir, argsText, ex.Message);
        }
    }

    private static Process Start(string appPath, string baseDir, string argsText)
    {
        ProcessStartInfo info = new ProcessStartInfo(appPath, argsText)
        {
            WorkingDirectory = baseDir,
            UseShellExecute = false,
        };
        return Process.Start(info);
    }

    private static int StartFallback(string appPath, string baseDir, string argsText, string reason)
    {
        try
        {
            string fallbackArgs = (argsText + " --no-sandbox --disable-gpu").Trim();
            ProcessStartInfo info = new ProcessStartInfo(appPath, fallbackArgs)
            {
                WorkingDirectory = baseDir,
                UseShellExecute = false,
            };
            Process fallback = Process.Start(info);
            if (fallback == null)
            {
                throw new InvalidOperationException("无法创建进程");
            }

            if (fallback.WaitForExit(FallbackProbeMs) && fallback.ExitCode != 0)
            {
                MessageBox.Show(
                    "个人技能树在兼容模式下也启动失败（退出码 " + fallback.ExitCode + "）。\r\n\r\n" +
                    "请把整个安装目录加入杀毒软件信任区，或打开命令提示符执行：\r\n" +
                    "SkillTree-app.exe --no-sandbox\r\n\r\n" +
                    "目录：" + baseDir,
                    "个人技能树",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error);
                return 4;
            }

            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                "个人技能树启动失败。\r\n\r\n原因：" + reason + "\r\n" + ex.Message +
                "\r\n\r\n请尝试把整个文件夹加入杀毒软件信任区，或从命令行运行 SkillTree-app.exe --no-sandbox。",
                "个人技能树",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
            return 3;
        }
    }

    private static string JoinArgs(string[] args)
    {
        if (args == null || args.Length == 0)
        {
            return string.Empty;
        }

        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < args.Length; i++)
        {
            if (i > 0)
            {
                builder.Append(' ');
            }
            builder.Append(Quote(args[i]));
        }
        return builder.ToString();
    }

    private static string Quote(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "\"\"";
        }
        if (value.IndexOfAny(new[] { ' ', '\t', '"' }) < 0)
        {
            return value;
        }

        StringBuilder builder = new StringBuilder("\"");
        int backslashes = 0;
        foreach (char c in value)
        {
            if (c == '\\')
            {
                backslashes++;
                continue;
            }
            if (c == '"')
            {
                builder.Append('\\', backslashes * 2 + 1);
                builder.Append('"');
                backslashes = 0;
            }
            else
            {
                builder.Append('\\', backslashes);
                backslashes = 0;
                builder.Append(c);
            }
        }
        builder.Append('\\', backslashes * 2);
        builder.Append('"');
        return builder.ToString();
    }
}
