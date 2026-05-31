using System;
using Microsoft.EntityFrameworkCore;

namespace OneStepServer;

public class ApplicatonContext : DbContext
{
    public ApplicatonContext(DbContextOptions<ApplicatonContext> options) : base(options)
    {
    }

    internal DbSet<User> Users { get; set; }


}
