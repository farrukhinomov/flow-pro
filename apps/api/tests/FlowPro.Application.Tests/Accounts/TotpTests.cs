using System.Text;
using FlowPro.Application.Accounts;

namespace FlowPro.Application.Tests.Accounts;

public sealed class TotpTests
{
    // RFC 6238 appendix B uses this key for its SHA-1 vectors.
    private static readonly byte[] RfcKey = Encoding.ASCII.GetBytes("12345678901234567890");

    [Theory]
    [InlineData(59L, "287082")]
    [InlineData(1111111109L, "081804")]
    [InlineData(1111111111L, "050471")]
    [InlineData(1234567890L, "005924")]
    [InlineData(2000000000L, "279037")]
    [InlineData(20000000000L, "353130")]
    public void Codes_match_the_RFC_6238_test_vectors(long unixSeconds, string expected)
    {
        // The RFC lists eight digits; authenticator apps show the last six.
        long step = Totp.TimeStep(DateTimeOffset.FromUnixTimeSeconds(unixSeconds));

        Assert.Equal(expected, Totp.Compute(RfcKey, step));
    }

    [Fact]
    public void A_code_is_accepted_one_step_either_side_and_no_further()
    {
        DateTimeOffset now = DateTimeOffset.FromUnixTimeSeconds(1_700_000_000);
        long current = Totp.TimeStep(now);

        Assert.Equal(current, Totp.Verify(RfcKey, Totp.Compute(RfcKey, current), now));
        Assert.Equal(current - 1, Totp.Verify(RfcKey, Totp.Compute(RfcKey, current - 1), now));
        Assert.Equal(current + 1, Totp.Verify(RfcKey, Totp.Compute(RfcKey, current + 1), now));
        Assert.Null(Totp.Verify(RfcKey, Totp.Compute(RfcKey, current - 2), now));
        Assert.Null(Totp.Verify(RfcKey, Totp.Compute(RfcKey, current + 2), now));
    }

    [Theory]
    [InlineData("123 456", "123456")]
    [InlineData("123-456", "123456")]
    [InlineData("12345", null)]
    [InlineData("1234567", null)]
    [InlineData("12a456", null)]
    [InlineData(null, null)]
    public void Codes_are_six_digits_with_optional_separators(string? input, string? expected)
    {
        Assert.Equal(expected, Totp.Normalize(input));
    }

    [Fact]
    public void Base32_matches_RFC_4648_and_round_trips()
    {
        Assert.Equal("MZXW6YTBOI", Base32.Encode("foobar"u8));
        Assert.Equal("foobar"u8.ToArray(), Base32.Decode("mzxw 6ytb oi"));

        byte[] key = Totp.GenerateKey();
        Assert.Equal(key, Base32.Decode(Base32.Encode(key)));
        Assert.Throws<FormatException>(() => Base32.Decode("MZXW1"));
    }

    [Fact]
    public void The_authenticator_link_names_the_issuer_and_account()
    {
        string uri = Totp.AuthenticatorUri("FlowPro", "ada+test@example.com", "foobar"u8);

        Assert.Equal(
            "otpauth://totp/FlowPro:ada%2Btest%40example.com?secret=MZXW6YTBOI&issuer=FlowPro"
            + "&algorithm=SHA1&digits=6&period=30",
            uri);
    }

    [Fact]
    public void Recovery_codes_are_distinct_readable_and_normalize_back()
    {
        IReadOnlyList<string> codes = RecoveryCodes.Generate();

        Assert.Equal(RecoveryCodes.Count, codes.Distinct(StringComparer.Ordinal).Count());
        Assert.All(codes, code => Assert.Matches("^[a-z2-9]{4}(-[a-z2-9]{4}){3}$", code));
        Assert.All(codes, code => Assert.DoesNotContain(code, character => character is '0' or 'o' or '1' or 'l' or 'i'));

        string code = codes[0];
        Assert.Equal(code.Replace("-", string.Empty, StringComparison.Ordinal), RecoveryCodes.Normalize($" {code.ToUpperInvariant()} "));
        Assert.Null(RecoveryCodes.Normalize("123456"));
        Assert.Null(RecoveryCodes.Normalize(code + "a"));
    }
}
