using System.Security.Cryptography;
using System.Text;

namespace FlowPro.Application.Sync;

public static class ClientAggregateIds
{
    /// <summary>
    /// The identifier the outbox and the audit trail use for a client aggregate, derived from its
    /// type and its client-chosen identifier so every write to the same record shares it.
    /// </summary>
    public static Guid Stable(string aggregate, string aggregateId)
    {
        byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes($"{aggregate}:{aggregateId}"));
        return new Guid(hash[..16]);
    }
}
