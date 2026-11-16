using FlowPro.Application.Accounts;

namespace FlowPro.Application.Tests.Accounts;

public sealed class SessionTokenTests
{
    [Fact]
    public void Generated_tokens_are_unique_and_url_safe()
    {
        HashSet<string> tokens = [.. Enumerable.Range(0, 200).Select(_ => SessionToken.Generate())];

        Assert.Equal(200, tokens.Count);
        Assert.All(tokens, token => Assert.True(SessionToken.LooksValid(token)));
    }

    [Fact]
    public void The_hash_is_stable_and_does_not_contain_the_token()
    {
        string token = SessionToken.Generate();

        string hash = SessionToken.Hash(token);

        Assert.Equal(hash, SessionToken.Hash(token));
        Assert.Equal(64, hash.Length);
        Assert.DoesNotContain(token, hash, StringComparison.Ordinal);
        Assert.NotEqual(hash, SessionToken.Hash(SessionToken.Generate()));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("short")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA A")]
    public void Malformed_values_are_rejected_before_any_lookup(string? value)
    {
        Assert.False(SessionToken.LooksValid(value));
    }
}
