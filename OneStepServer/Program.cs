using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using OneStepServer;
using Npgsql.EntityFrameworkCore.PostgreSQL;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.

builder.Services.AddControllers();
builder.Services.AddDbContext<ApplicatonContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

builder.Services.AddSignalR();

builder.Services.AddCors(options =>
{
	options.AddPolicy("AllowFrontend", policy =>
		policy.WithOrigins(["http://localhost:5173", "https://one-step-1yyv7tzkx-richardsrobinrs-projects.vercel.app","https://one-step-eosin.vercel.app"])
			.AllowAnyMethod()
			.AllowAnyHeader()
			.AllowCredentials());
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
.AddJwtBearer(jwtOptions =>
{

    jwtOptions.MapInboundClaims = false;

	jwtOptions.Authority = "https://dzcuxcxljlzjdpildzpi.supabase.co/auth/v1";
	jwtOptions.TokenValidationParameters =
            new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidAudience = "authenticated",
                ValidateAudience = true
            };
});

var app = builder.Build();


// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseCors("AllowFrontend");

app.UseAuthentication();

app.UseAuthorization();

app.MapControllers();

// app.UseDefaultFiles();
// app.UseStaticFiles();
app.MapHub<PlayGroundHub>("/playgroundHub");


app.Run();
