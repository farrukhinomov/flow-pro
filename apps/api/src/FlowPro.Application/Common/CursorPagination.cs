using System.Text;

namespace FlowPro.Application.Common;

public sealed record CursorPageRequest(
    string? Cursor = null,
    int Limit = CursorPageRequest.DefaultLimit)
{
    public const int DefaultLimit = 50;
    public const int MaxLimit = 100;

    public int NormalizedLimit => Math.Clamp(Limit, 1, MaxLimit);
}

public sealed record CursorPage<T>(
    IReadOnlyList<T> Items,
    string? NextCursor);

public sealed record SortField(
    string Field,
    string Direction = SortDirections.Ascending);

public static class SortDirections
{
    public const string Ascending = "asc";
    public const string Descending = "desc";

    public static bool IsSupported(string value) =>
        value is Ascending or Descending;
}

public static class OffsetCursor
{
    public static string Encode(int offset) =>
        Convert.ToBase64String(Encoding.UTF8.GetBytes(offset.ToString(System.Globalization.CultureInfo.InvariantCulture)));

    public static int Decode(string? cursor)
    {
        if (string.IsNullOrWhiteSpace(cursor))
        {
            return 0;
        }

        try
        {
            string decoded = Encoding.UTF8.GetString(Convert.FromBase64String(cursor));
            return int.TryParse(
                decoded,
                System.Globalization.NumberStyles.None,
                System.Globalization.CultureInfo.InvariantCulture,
                out int offset)
                && offset > 0
                    ? offset
                    : 0;
        }
        catch (FormatException)
        {
            return 0;
        }
    }
}
